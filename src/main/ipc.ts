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
  SetLanguageRequest,
  SetThemeRequest,
  SetOpenAIModelRequest,
  WriteTextFileRequest
} from '../shared/policy'
import type { ProviderId } from '../shared/policy'
import type {
  TaskCreateRequest,
  TaskApproveRequest,
  TaskCancelRequest,
  TaskGetRequest
} from '../shared/task'
import { loadPolicy, savePolicy } from './policy-store'
import { resolveInsideWorkspace } from './workspace-path'
import { getSecret, hasSecret, setSecret } from './secret-store'
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
import { claudeRespond } from './providers/claude'
import { deepseekRespond } from './providers/deepseek'
import { kimiRespond } from './providers/kimi'
import type { TaskManager } from './agent/task-manager'
import type { TelegramBot } from './telegram/telegram-bot'

let policy = DEFAULT_POLICY

// Supabase token store — set by renderer via IPC when user signs in.
// Used by vision providers (claude-vision, deepseek-vision) that call edge functions.
let _supabaseToken: string | null = null

export function getSupabaseToken(): string | null {
  return _supabaseToken
}

export function setSupabaseToken(token: string | null): void {
  _supabaseToken = token
}

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
  telegramBot: TelegramBot
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

  ipcMain.handle(IPC.pickWorkspace, async (_evt) => {
    const win = BrowserWindow.fromWebContents(_evt.sender)
    const opts = {
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
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

  ipcMain.handle(IPC.showOpenFilesDialog, async (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const opts = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [
        { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Documentos', extensions: ['pdf', 'txt', 'md', 'json'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return { canceled: result.canceled, filePaths: result.filePaths }
  })

  const VALID_PROVIDERS: ProviderId[] = ['chatgpt', 'claude', 'deepseek', 'kimi']

  ipcMain.handle(IPC.setActiveProvider, async (_evt, providerId: string) => {
    if (!VALID_PROVIDERS.includes(providerId as ProviderId)) {
      throw new Error(`Unknown provider: ${providerId}`)
    }
    policy = { ...policy, provider: { ...policy.provider, active: providerId as ProviderId } }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setLanguage, async (_evt, req: SetLanguageRequest) => {
    const lang = req.language
    if (lang !== 'en' && lang !== 'es') {
      throw new Error('Invalid language')
    }
    policy = { ...policy, language: lang }
    await savePolicy(policy)
    return policy
  })

  ipcMain.handle(IPC.setProviderApiKey, async (_evt, req: { provider: string; apiKey: string }) => {
    const key = (req.apiKey ?? '').trim()
    if (!key) throw new Error('API key is required')
    await setSecret(`${req.provider}.apiKey`, key)
    return true
  })

  ipcMain.handle(IPC.hasProviderApiKey, async (_evt, req: { provider: string }) => {
    return hasSecret(`${req.provider}.apiKey`)
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

  ipcMain.handle(IPC.setTaskMemoryEnabled, async (_evt, enabled: boolean) => {
    policy = { ...policy, taskMemoryEnabled: !!enabled }
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

    const active = policy.provider.active

    if (active === 'chatgpt') {
      const content = await codexRespond({ messages: req.messages })
      return { content }
    }

    if (active === 'kimi') {
      const apiKey = await getSecret('kimi.apiKey')
      if (!apiKey) throw new Error('Kimi API key is not set. Go to Settings and add it.')
      const content = await kimiRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'claude') {
      const apiKey = await getSecret('claude.apiKey')
      if (!apiKey) throw new Error('Claude API key is not set. Go to Settings and add it.')
      const content = await claudeRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'deepseek') {
      const apiKey = await getSecret('deepseek.apiKey')
      if (!apiKey) throw new Error('DeepSeek API key is not set. Go to Settings and add it.')
      const content = await deepseekRespond({ apiKey, messages: req.messages })
      return { content }
    }

    throw new Error(`Unknown provider: ${active}`)
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

  // ── Telegram ────────────────────────────────────────────────────────
  const tg = opts.telegramBot

  ipcMain.handle(IPC.telegramGetSettings, async () => {
    return tg.getSettings()
  })

  ipcMain.handle(IPC.telegramSetEnabled, async (_evt, enabled: boolean) => {
    await tg.setEnabled(enabled)
    return tg.getSettings()
  })

  ipcMain.handle(IPC.telegramSetToken, async (_evt, token: string) => {
    await setSecret('telegram.botToken', token.trim())
    return true
  })

  ipcMain.handle(IPC.telegramGeneratePairingCode, async () => {
    return tg.generatePairingCode()
  })

  ipcMain.handle(IPC.telegramUnpair, async () => {
    await tg.unpair()
    return true
  })

  // ── Secrets ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.getSecret, async (_evt, key: string) => {
    return getSecret(key)
  })

  ipcMain.handle(IPC.setSecret, async (_evt, req: { key: string; value: string }) => {
    await setSecret(req.key, req.value)
  })
}
