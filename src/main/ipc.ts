import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { IPC } from '../shared/ipc'
import {
  ChatSendRequest,
  ChatSendResponse,
  DEFAULT_POLICY,
  ReadTextFileRequest,
  SetCapabilityRequest,
  SetThemeRequest,
  SetOpenAIModelRequest,
  WriteTextFileRequest
} from '../shared/policy'
import type {
  TaskCreateRequest,
  TaskApproveRequest,
  TaskCancelRequest,
  TaskGetRequest
} from '../shared/task'
import { loadPolicy, savePolicy } from './policy-store'
import { resolveInsideWorkspace } from './workspace-path'
import { getSecret, hasSecret, setSecret } from './secret-store'
import { openaiRespond } from './providers/openai'
import {
  buildAuthorizeUrl,
  clearTokens,
  codexRespond,
  exchangeCodeForTokens,
  generatePKCE,
  generateState,
  loadTokens,
  saveTokens
} from './providers/codex'
import type { TaskManager } from './agent/task-manager'

let policy = DEFAULT_POLICY

// Pending ChatGPT PKCE state (lives only while OAuth is in-flight)
let pendingChatGPTOAuth: {
  verifier: string
  challenge: string
  state: string
  redirectUri: string
  mainWindow: import('electron').BrowserWindow
} | null = null

function openWindowsDefaultBrowser(url: string): void {
  // WSL interop: avoid cmd parsing issues with & by using PowerShell.
  const escaped = url.replaceAll("'", "''")
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${escaped}'`],
    {
      stdio: 'ignore',
      detached: true
    }
  )
  child.unref()
}

export async function initPolicy(): Promise<void> {
  policy = await loadPolicy()
}

/**
 * Called by the auth callback server when a code arrives at /auth/callback.
 * Returns true if the code was for ChatGPT OAuth (suppresses Supabase handling).
 */
export async function tryHandleChatGPTCallback(
  code: string,
  state: string | null
): Promise<boolean> {
  if (!pendingChatGPTOAuth || state !== pendingChatGPTOAuth.state) return false

  const { verifier, redirectUri, mainWindow } = pendingChatGPTOAuth
  pendingChatGPTOAuth = null

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri, verifier)
    await saveTokens(tokens)
    mainWindow.webContents.send('netbot:chatgpt:auth:success')
  } catch (e) {
    mainWindow.webContents.send('netbot:chatgpt:auth:error', {
      message: e instanceof Error ? e.message : String(e)
    })
  }

  return true
}

export function registerIpcHandlers(opts: {
  openAuthUrl: (url: string) => void
  taskManager: TaskManager
}): void {
  // Give TaskManager access to current policy (provider, model, etc.)
  opts.taskManager.setPolicyGetter(() => policy)

  ipcMain.handle(IPC.ping, async () => {
    return 'pong'
  })

  ipcMain.handle(IPC.openExternal, async (_evt, url: string) => {
    const u = String(url ?? '')
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are allowed')
    }

    // If running under WSL, open the Windows host default browser.
    const isWsl = Boolean(process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME)
    if (isWsl) {
      try {
        openWindowsDefaultBrowser(u)
      } catch {
        const child = spawn('cmd.exe', ['/c', 'start', '', u], {
          stdio: 'ignore',
          detached: true
        })
        child.unref()
      }
      return
    }

    await shell.openExternal(u)
  })

  ipcMain.handle(IPC.authOpen, async (_evt, url: string) => {
    const u = String(url ?? '')
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are allowed')
    }
    opts.openAuthUrl(u)
  })

  ipcMain.handle(IPC.getPolicy, async () => {
    return policy
  })

  ipcMain.handle(IPC.pickWorkspace, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return policy

    policy = {
      ...policy,
      workspaceRoot: result.filePaths[0]
    }
    await savePolicy(policy)
    return policy
  })

  // ── Window controls ───────────────────────────────────────────────────────

  ipcMain.handle(IPC.windowMinimize, (evt) => {
    BrowserWindow.fromWebContents(evt.sender)?.minimize()
  })
  ipcMain.handle(IPC.windowMaximize, (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle(IPC.windowClose, (evt) => {
    BrowserWindow.fromWebContents(evt.sender)?.close()
  })

  ipcMain.handle(IPC.setActiveProvider, async (_evt, providerId: string) => {
    if (providerId !== 'openai' && providerId !== 'chatgpt') {
      throw new Error(`Unknown provider: ${providerId}`)
    }
    policy = { ...policy, provider: { ...policy.provider, active: providerId } }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setCapability, async (_evt, req: SetCapabilityRequest) => {
    policy = {
      ...policy,
      capabilities: {
        ...policy.capabilities,
        [req.id]: !!req.enabled
      }
    }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setTheme, async (_evt, req: SetThemeRequest) => {
    const mode = req.themeMode
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
      throw new Error('Invalid theme mode')
    }

    policy = {
      ...policy,
      themeMode: mode
    }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setOpenAIModel, async (_evt, req: SetOpenAIModelRequest) => {
    const model = (req.model ?? '').trim()
    if (!model) throw new Error('Model is required')
    policy = {
      ...policy,
      provider: {
        ...policy.provider,
        openaiModel: model
      }
    }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setOpenAIApiKey, async (_evt, apiKey: string) => {
    const key = (apiKey ?? '').trim()
    if (!key) throw new Error('API key is required')
    await setSecret('openai.apiKey', key)
    return true
  })

  ipcMain.handle(IPC.hasOpenAIApiKey, async () => {
    return hasSecret('openai.apiKey')
  })

  // ── ChatGPT OAuth ─────────────────────────────────────────────────────────

  ipcMain.handle(IPC.chatgptOAuthStart, async (evt) => {
    const REDIRECT_URI = 'http://localhost:1455/auth/callback'
    const pkce = await generatePKCE()
    const state = generateState()

    // Get the BrowserWindow that sent this request
    const { BrowserWindow: BW } = await import('electron')
    const win = BW.fromWebContents(evt.sender) ?? BW.getAllWindows()[0]

    pendingChatGPTOAuth = {
      verifier: pkce.verifier,
      challenge: pkce.challenge,
      state,
      redirectUri: REDIRECT_URI,
      mainWindow: win
    }

    const url = buildAuthorizeUrl(REDIRECT_URI, pkce, state)
    opts.openAuthUrl(url)
    return url
  })

  ipcMain.handle(IPC.chatgptHasAuth, async () => {
    const tokens = await loadTokens()
    return Boolean(tokens?.access)
  })

  ipcMain.handle(IPC.chatgptSignOut, async () => {
    pendingChatGPTOAuth = null
    await clearTokens()
    return true
  })

  // ── Chat send ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.chatSend, async (_evt, req: ChatSendRequest): Promise<ChatSendResponse> => {
    if (!policy.capabilities['net.http']) {
      throw new Error('Capability net.http is disabled')
    }

    if (policy.provider.active === 'chatgpt') {
      const content = await codexRespond({ messages: req.messages })
      return { content }
    }

    if (policy.provider.active !== 'openai') {
      throw new Error('Active provider is not supported yet')
    }

    const apiKey = await getSecret('openai.apiKey')
    if (!apiKey) throw new Error('OpenAI API key is not set')

    const content = await openaiRespond({
      apiKey,
      model: policy.provider.openaiModel,
      messages: req.messages
    })

    return { content }
  })

  ipcMain.handle(IPC.fsReadText, async (_evt, req: ReadTextFileRequest) => {
    if (!policy.capabilities['fs.read']) throw new Error('Capability fs.read is disabled')
    if (!policy.workspaceRoot) throw new Error('No workspace selected')

    const abs = resolveInsideWorkspace(policy.workspaceRoot, req.path)
    const content = await readFile(abs, 'utf8')
    return content
  })

  ipcMain.handle(IPC.fsWriteText, async (_evt, req: WriteTextFileRequest) => {
    if (!policy.capabilities['fs.write']) throw new Error('Capability fs.write is disabled')
    if (!policy.workspaceRoot) throw new Error('No workspace selected')

    const abs = resolveInsideWorkspace(policy.workspaceRoot, req.path)
    const flag = req.ifExists === 'overwrite' ? 'w' : 'wx'
    await writeFile(abs, req.content, { encoding: 'utf8', flag })
  })

  // ── Task Agent ──────────────────────────────────────────────────────────

  const tm = opts.taskManager

  ipcMain.handle(IPC.taskCreate, async (_evt, req: TaskCreateRequest) => {
    const task = tm.create(req)
    return { task }
  })

  ipcMain.handle(IPC.taskApprove, async (_evt, req: TaskApproveRequest) => {
    return tm.approve(req.taskId)
  })

  ipcMain.handle(IPC.taskCancel, async (_evt, req: TaskCancelRequest) => {
    return tm.cancel(req.taskId)
  })

  ipcMain.handle(IPC.taskPause, async (_evt, req: { taskId: string }) => {
    // Pause = cancel for now (can be extended later)
    return tm.cancel(req.taskId)
  })

  ipcMain.handle(IPC.taskResume, async (_evt, req: { taskId: string }) => {
    // Resume not implemented yet — return current state
    const task = tm.get(req.taskId)
    if (!task) throw new Error('Task not found')
    return task
  })

  ipcMain.handle(IPC.taskGet, async (_evt, req: TaskGetRequest) => {
    const task = tm.get(req.taskId)
    if (!task) throw new Error('Task not found')
    return task
  })

  ipcMain.handle(IPC.taskList, async () => {
    return { tasks: tm.list() }
  })

  ipcMain.handle(IPC.taskDelete, async (_evt, req: { taskId: string }) => {
    tm.delete(req.taskId)
    return true
  })
}
