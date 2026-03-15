import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
import { readFile, writeFile } from 'fs/promises'
import os from 'os'
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
  projectList,
  projectCreate,
  projectUpdate,
  projectDelete,
  projectAddTask,
  projectRemoveTask
} from './project-store'
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
import { glmRespond } from './providers/glm'
import { minimaxRespond } from './providers/minimax'
import { openrouterRespond } from './providers/openrouter'
import { geminiRespond } from './providers/gemini'
import { ollamaRespond } from './providers/ollama'
import type { TaskManager } from './agent/task-manager'
import type { ChannelManager } from './channels/channel-manager'
import type { RuntimeStats } from '../shared/runtime'
import { loadSnapshots, deleteSnapshot } from './browser-snapshots'
import type { ChannelId } from '../shared/channel'
import type { Skill } from '../shared/skill'
import { loadSkills, saveSkills, createSkillId } from './skill-store'
import type { Schedule } from '../shared/schedule'
import { loadSchedules, saveSchedules, createScheduleId } from './schedule-store'
import { saveFact, deleteFact, listFacts } from './agent/task-memory'

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
    mainWindow.webContents.send('skynul:chatgpt:auth:success')
  } catch (e) {
    mainWindow.webContents.send('skynul:chatgpt:auth:error', {
      message: e instanceof Error ? e.message : String(e)
    })
  }

  return true
}

export function registerIpcHandlers(opts: {
  openAuthUrl: (url: string) => void
  taskManager: TaskManager
  channelManager: ChannelManager
}): void {
  // Give TaskManager access to current policy (provider, model, etc.)
  opts.taskManager.setPolicyGetter(() => policy)

  ipcMain.handle(IPC.ping, async () => {
    return 'pong'
  })

  ipcMain.handle(IPC.runtimeGetStats, async (): Promise<RuntimeStats> => {
    const metrics = app.getAppMetrics()

    let cpu = 0
    let memMB = 0
    for (const m of metrics) {
      cpu += m.cpu?.percentCPUUsage ?? 0
      const wsKb = m.memory?.workingSetSize ?? 0
      memMB += wsKb / 1024
    }

    const totalMemMB = os.totalmem() / (1024 * 1024)
    const freeMemMB = os.freemem() / (1024 * 1024)
    const loadavg1m = os.loadavg?.()[0] ?? 0

    return {
      ts: Date.now(),
      app: {
        cpuPercent: cpu,
        memoryMB: memMB,
        processCount: metrics.length
      },
      system: {
        totalMemMB,
        freeMemMB,
        loadavg1m
      }
    }
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
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
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
        { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
        {
          name: 'Documentos',
          extensions: ['pdf', 'txt', 'md', 'json', 'doc', 'docx', 'ppt', 'pptx']
        },
        { name: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv'] },
        { name: 'Todos', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return { canceled: result.canceled, filePaths: result.filePaths }
  })

  const VALID_PROVIDERS: ProviderId[] = [
    'chatgpt',
    'claude',
    'deepseek',
    'kimi',
    'glm',
    'minimax',
    'openrouter',
    'gemini',
    'ollama'
  ]

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

  // ── Ollama ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.ollamaPing, async () => {
    const baseUrl = (await getSecret('ollama.baseUrl')) || 'http://localhost:11434'
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.ollamaInstalled, async () => {
    try {
      const { stdout } = await execAsync(process.platform === 'win32' ? 'where ollama' : 'which ollama')
      return !!stdout.trim()
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.ollamaModels, async () => {
    const baseUrl = (await getSecret('ollama.baseUrl')) || 'http://localhost:11434'
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return (data.models ?? []).map((m) => m.name)
    } catch {
      return []
    }
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

  ipcMain.handle(IPC.setTaskAutoApprove, async (_evt, enabled: boolean) => {
    policy = { ...policy, taskAutoApprove: !!enabled }
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

    if (active === 'glm') {
      const apiKey = await getSecret('glm.apiKey')
      if (!apiKey) throw new Error('GLM API key is not set. Go to Settings and add it.')
      const content = await glmRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'minimax') {
      const apiKey = await getSecret('minimax.apiKey')
      if (!apiKey) throw new Error('MiniMax API key is not set. Go to Settings and add it.')
      const content = await minimaxRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'openrouter') {
      const apiKey = await getSecret('openrouter.apiKey')
      if (!apiKey) throw new Error('OpenRouter API key is not set. Go to Settings and add it.')
      const content = await openrouterRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'gemini') {
      const apiKey = await getSecret('gemini.apiKey')
      if (!apiKey) throw new Error('Gemini API key is not set. Go to Settings and add it.')
      const content = await geminiRespond({ apiKey, messages: req.messages })
      return { content }
    }

    if (active === 'ollama') {
      const content = await ollamaRespond({ messages: req.messages })
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

  ipcMain.handle(IPC.clipboardReadText, () => clipboard.readText())

  // Returns the temp file path if clipboard has an image, null otherwise.
  ipcMain.handle(IPC.fsSaveTempFile, async () => {
    // Try Electron native first (works on Windows/Mac)
    const img = clipboard.readImage()
    if (!img.isEmpty()) {
      return `data:image/png;base64,${img.toPNG().toString('base64')}`
    }

    // WSL2: imagen vive en el clipboard de Windows.
    // Usamos -EncodedCommand (base64 UTF-16LE) para evitar conversión de paths y escaping.
    try {
      const fname = `skynul-paste-${Date.now()}.png`
      const psLines = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        `$p = $env:TEMP + "\\${fname}"`,
        '$clip = [System.Windows.Forms.Clipboard]::GetDataObject()',
        'if ($clip -eq $null) { Write-Output "DBG:NULL_CLIP"; exit }',
        'Write-Output ("DBG:FORMATS=" + ($clip.GetFormats() -join ","))',
        '$saved = $false',
        // PNG stream — lo más común: captura de pantalla, copiar imagen desde browser
        'if (-not $saved -and $clip.GetDataPresent("PNG")) {',
        '  try {',
        '    $s = $clip.GetData("PNG")',
        '    ([System.Drawing.Bitmap]::new($s)).Save($p, [System.Drawing.Imaging.ImageFormat]::Png)',
        '    $saved = $true',
        '  } catch { Write-Output ("DBG:PNG_ERR=" + $_) }',
        '}',
        // Bitmap estándar
        'if (-not $saved -and $clip.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) {',
        '  try {',
        '    ($clip.GetData([System.Windows.Forms.DataFormats]::Bitmap)).Save($p, [System.Drawing.Imaging.ImageFormat]::Png)',
        '    $saved = $true',
        '  } catch { Write-Output ("DBG:BMP_ERR=" + $_) }',
        '}',
        // GetImage() fallback
        'if (-not $saved) {',
        '  $gi = [System.Windows.Forms.Clipboard]::GetImage()',
        '  if ($gi -ne $null) {',
        '    try { $gi.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $saved = $true }',
        '    catch { Write-Output ("DBG:GETIMG_ERR=" + $_) }',
        '  }',
        '}',
        'if ($saved) { Write-Output $p } else { Write-Output "DBG:NO_IMAGE" }'
      ]
      const encoded = Buffer.from(psLines.join('\r\n'), 'utf16le').toString('base64')
      const { stdout: rawOut, stderr: rawErr } = await execAsync(
        `powershell.exe -STA -NoProfile -NonInteractive -EncodedCommand "${encoded}"`
      )
      console.log('[clipboard] PS out:', JSON.stringify(rawOut))
      if (rawErr) console.log('[clipboard] PS err:', JSON.stringify(rawErr))

      const winPath =
        rawOut
          .split('\n')
          .map((l) => l.trim())
          .find((l) => /^[A-Za-z]:\\/.test(l)) ?? ''
      if (!winPath) return null

      const { stdout: linuxPath } = await execAsync(`wslpath -u "${winPath}"`)
      const winMounted = linuxPath.trim()
      if (!winMounted) return null

      const imgData = await readFile(winMounted)
      return `data:image/png;base64,${imgData.toString('base64')}`
    } catch (e) {
      console.error('[clipboard] error:', e)
      return null
    }
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

  ipcMain.handle(IPC.taskSendMessage, async (_evt, req: { taskId: string; message: string }) => {
    tm.sendMessage(req.taskId, 'user', req.message)
    return true
  })

  // ── Skills ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC.skillList, async () => loadSkills())

  ipcMain.handle(
    IPC.skillSave,
    async (_evt, skill: Omit<Skill, 'id' | 'createdAt'> & { id?: string }) => {
      const skills = await loadSkills()
      if (skill.id) {
        const idx = skills.findIndex((s) => s.id === skill.id)
        if (idx !== -1) {
          skills[idx] = { ...skills[idx], ...skill } as Skill
        }
      } else {
        skills.push({ ...skill, id: createSkillId(), createdAt: Date.now() } as Skill)
      }
      await saveSkills(skills)
      return skills
    }
  )

  ipcMain.handle(IPC.skillDelete, async (_evt, id: string) => {
    const skills = (await loadSkills()).filter((s) => s.id !== id)
    await saveSkills(skills)
    return skills
  })

  ipcMain.handle(IPC.skillToggle, async (_evt, id: string) => {
    const skills = await loadSkills()
    const s = skills.find((sk) => sk.id === id)
    if (s) s.enabled = !s.enabled
    await saveSkills(skills)
    return skills
  })

  ipcMain.handle(IPC.skillImport, async (_evt, filePath: string) => {
    const raw = await readFile(filePath, 'utf8')
    const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown')

    // Default name from filename (without extension)
    const basename = filePath.split(/[\\/]/).pop() ?? 'Imported'
    const nameFromFile = basename.replace(/\.(json|md|markdown)$/i, '')

    let name = nameFromFile
    let tag = ''
    let description = ''
    let prompt = raw

    if (isMarkdown) {
      // Parse YAML frontmatter between --- delimiters
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      if (fmMatch) {
        const frontmatter = fmMatch[1]
        prompt = fmMatch[2].trim()
        for (const line of frontmatter.split('\n')) {
          const [key, ...rest] = line.split(':')
          const val = rest.join(':').trim()
          if (key.trim() === 'name') name = val
          else if (key.trim() === 'tag' || key.trim() === 'category') tag = val
          else if (key.trim() === 'description') description = val
        }
      }
    } else {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      name = String(parsed.name ?? nameFromFile)
      tag = String(parsed.tag ?? parsed.category ?? '')
      description = String(parsed.description ?? '')
      prompt = String(parsed.prompt ?? '')
    }

    const skills = await loadSkills()
    skills.push({
      id: createSkillId(),
      name,
      tag,
      description,
      prompt,
      enabled: true,
      createdAt: Date.now()
    })
    await saveSkills(skills)
    return skills
  })

  // ── User Facts ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.factList, () => listFacts())
  ipcMain.handle(IPC.factSave, (_evt, fact: string) => {
    saveFact(fact)
    return listFacts()
  })
  ipcMain.handle(IPC.factDelete, (_evt, id: number) => {
    deleteFact(id)
    return listFacts()
  })

  // ── Channels ────────────────────────────────────────────────────────
  const cm = opts.channelManager

  ipcMain.handle(IPC.channelGetAll, async () => {
    return cm.getAllSettings()
  })

  ipcMain.handle(IPC.channelGetSettings, async (_evt, channelId: ChannelId) => {
    return cm.getChannel(channelId).getSettings()
  })

  ipcMain.handle(IPC.channelSetEnabled, async (_evt, channelId: ChannelId, enabled: boolean) => {
    return cm.getChannel(channelId).setEnabled(enabled)
  })

  ipcMain.handle(
    IPC.channelSetCredentials,
    async (_evt, channelId: ChannelId, creds: Record<string, string>) => {
      await cm.getChannel(channelId).setCredentials(creds)
      return cm.getChannel(channelId).getSettings()
    }
  )

  ipcMain.handle(IPC.channelGeneratePairing, async (_evt, channelId: ChannelId) => {
    return cm.getChannel(channelId).generatePairingCode()
  })

  ipcMain.handle(IPC.channelUnpair, async (_evt, channelId: ChannelId) => {
    await cm.getChannel(channelId).unpair()
    return cm.getChannel(channelId).getSettings()
  })

  ipcMain.handle(IPC.channelGetGlobal, async () => {
    return cm.getGlobalSettings()
  })

  ipcMain.handle(IPC.channelSetAutoApprove, async (_evt, val: boolean) => {
    return cm.setAutoApprove(val)
  })

  // ── Schedules ─────────────────────────────────────────────────────────

  ipcMain.handle(IPC.scheduleList, async () => loadSchedules())

  ipcMain.handle(
    IPC.scheduleSave,
    async (_evt, sched: Omit<Schedule, 'id' | 'createdAt'> & { id?: string }) => {
      const schedules = await loadSchedules()
      if (sched.id) {
        const idx = schedules.findIndex((s) => s.id === sched.id)
        if (idx !== -1) {
          schedules[idx] = { ...schedules[idx], ...sched } as Schedule
        }
      } else {
        schedules.push({
          ...sched,
          id: createScheduleId(),
          createdAt: Date.now()
        } as Schedule)
      }
      await saveSchedules(schedules)
      return schedules
    }
  )

  ipcMain.handle(IPC.scheduleDelete, async (_evt, id: string) => {
    const schedules = (await loadSchedules()).filter((s) => s.id !== id)
    await saveSchedules(schedules)
    return schedules
  })

  ipcMain.handle(IPC.scheduleToggle, async (_evt, id: string) => {
    const schedules = await loadSchedules()
    const s = schedules.find((sc) => sc.id === id)
    if (s) s.enabled = !s.enabled
    await saveSchedules(schedules)
    return schedules
  })

  // ── Audio Transcription ──────────────────────────────────────────────

  ipcMain.handle(IPC.transcribeAudio, async (_evt, audioBuffer: ArrayBuffer) => {
    const apiKey = await getSecret('openai.apiKey')
    if (!apiKey)
      throw new Error('OpenAI API key required for voice input. Set it in Settings → Providers.')

    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('file', blob, 'voice.webm')
    formData.append('model', 'whisper-1')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Whisper API error ${res.status}: ${text}`)
    }

    const json = (await res.json()) as { text?: string }
    return json.text ?? ''
  })

  // ── Browser Snapshots ────────────────────────────────────────────────
  ipcMain.handle(IPC.browserSnapshotList, async () => loadSnapshots())

  ipcMain.handle(IPC.browserSnapshotSave, async () => {
    throw new Error(
      'Browser snapshots require an active browser session. Start a browser task first.'
    )
  })

  ipcMain.handle(IPC.browserSnapshotRestore, async () => {
    throw new Error(
      'Browser snapshot restore requires an active browser session. Start a browser task first.'
    )
  })

  ipcMain.handle(IPC.browserSnapshotDelete, async (_evt, id: string) => {
    await deleteSnapshot(id)
    return true
  })

  // ── Auto-Update ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.updateCheck, async () => {
    const { checkForUpdates } = await import('./updater')
    await checkForUpdates()
  })
  ipcMain.handle(IPC.updateDownload, async () => {
    const { downloadUpdate } = await import('./updater')
    await downloadUpdate()
  })
  ipcMain.handle(IPC.updateInstall, async () => {
    const { installUpdate } = await import('./updater')
    installUpdate()
  })

  // ── Secrets ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.getSecret, async (_evt, key: string) => {
    return getSecret(key)
  })

  ipcMain.handle(IPC.setSecret, async (_evt, req: { key: string; value: string }) => {
    await setSecret(req.key, req.value)
  })

  // ── Projects ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.projectList, () => projectList())

  ipcMain.handle(IPC.projectCreate, (_evt, req: { name: string; color?: string }) => {
    return projectCreate(req.name, req.color)
  })

  ipcMain.handle(IPC.projectUpdate, (_evt, req: { id: string; name: string; color: string }) => {
    projectUpdate(req.id, req.name, req.color)
  })

  ipcMain.handle(IPC.projectDelete, (_evt, id: string) => {
    projectDelete(id)
  })

  ipcMain.handle(IPC.projectAddTask, (_evt, req: { projectId: string; taskId: string }) => {
    projectAddTask(req.projectId, req.taskId)
  })

  ipcMain.handle(IPC.projectRemoveTask, (_evt, req: { projectId: string; taskId: string }) => {
    projectRemoveTask(req.projectId, req.taskId)
  })
}
