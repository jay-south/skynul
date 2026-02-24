import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  CapabilityId,
  ChatSendRequest,
  ChatSendResponse,
  LanguageCode,
  PolicyState,
  ReadTextFileRequest,
  SetCapabilityRequest,
  SetLanguageRequest,
  SetOpenAIModelRequest,
  SetThemeRequest,
  ThemeMode,
  WriteTextFileRequest
} from '../shared/policy'
import type {
  Task,
  TaskCapabilityId,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskListResponse,
  TaskUpdateEvent
} from '../shared/task'

const netbot = {
  ping: (): Promise<string> => ipcRenderer.invoke(IPC.ping),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),
  authOpen: (url: string): Promise<void> => ipcRenderer.invoke(IPC.authOpen, url),
  getPolicy: (): Promise<PolicyState> => ipcRenderer.invoke(IPC.getPolicy),
  pickWorkspace: (): Promise<PolicyState> => ipcRenderer.invoke(IPC.pickWorkspace),
  setCapability: (id: CapabilityId, enabled: boolean): Promise<PolicyState> => {
    const req: SetCapabilityRequest = { id, enabled }
    return ipcRenderer.invoke(IPC.setCapability, req)
  },
  setTheme: (themeMode: ThemeMode): Promise<PolicyState> => {
    const req: SetThemeRequest = { themeMode }
    return ipcRenderer.invoke(IPC.setTheme, req)
  },
  setOpenAIModel: (model: string): Promise<PolicyState> => {
    const req: SetOpenAIModelRequest = { model }
    return ipcRenderer.invoke(IPC.setOpenAIModel, req)
  },
  setOpenAIApiKey: (apiKey: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC.setOpenAIApiKey, apiKey)
  },
  hasOpenAIApiKey: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC.hasOpenAIApiKey)
  },
  chatSend: (messages: ChatSendRequest['messages']): Promise<ChatSendResponse> => {
    const req: ChatSendRequest = { messages }
    return ipcRenderer.invoke(IPC.chatSend, req)
  },
  fsReadText: (path: string): Promise<string> => {
    const req: ReadTextFileRequest = { path }
    return ipcRenderer.invoke(IPC.fsReadText, req)
  },
  fsWriteText: (path: string, content: string, ifExists?: 'fail' | 'overwrite'): Promise<void> => {
    const req: WriteTextFileRequest = { path, content, ifExists }
    return ipcRenderer.invoke(IPC.fsWriteText, req)
  },
  onAuthCallback: (cb: (url: string) => void): (() => void) => {
    const handler = (_evt: unknown, payload: { url: string }): void => cb(payload.url)
    ipcRenderer.on('netbot:auth:callback', handler)
    return () => ipcRenderer.off('netbot:auth:callback', handler)
  },

  // ── ChatGPT OAuth ──────────────────────────────────────────────────────
  windowMinimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMaximize),
  windowClose: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
  showOpenFilesDialog: (): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke(IPC.showOpenFilesDialog),
  setActiveProvider: (id: string): Promise<PolicyState> => ipcRenderer.invoke(IPC.setActiveProvider, id),
  setProviderApiKey: (provider: string, apiKey: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.setProviderApiKey, { provider, apiKey }),
  hasProviderApiKey: (provider: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.hasProviderApiKey, { provider }),
  setLanguage: (language: LanguageCode): Promise<PolicyState> => {
    const req: SetLanguageRequest = { language }
    return ipcRenderer.invoke(IPC.setLanguage, req)
  },
  chatgptOAuthStart: (): Promise<string> => ipcRenderer.invoke(IPC.chatgptOAuthStart),
  chatgptHasAuth: (): Promise<boolean> => ipcRenderer.invoke(IPC.chatgptHasAuth),
  chatgptSignOut: (): Promise<boolean> => ipcRenderer.invoke(IPC.chatgptSignOut),
  onChatGPTAuthSuccess: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('netbot:chatgpt:auth:success', handler)
    return () => ipcRenderer.off('netbot:chatgpt:auth:success', handler)
  },
  onChatGPTAuthError: (cb: (message: string) => void): (() => void) => {
    const handler = (_evt: unknown, payload: { message: string }): void => cb(payload.message)
    ipcRenderer.on('netbot:chatgpt:auth:error', handler)
    return () => ipcRenderer.off('netbot:chatgpt:auth:error', handler)
  },

  // ── Task Agent ──────────────────────────────────────────────────────
  taskCreate: (
    prompt: string,
    capabilities: TaskCapabilityId[],
    opts?: { maxSteps?: number; timeoutMs?: number }
  ): Promise<TaskCreateResponse> => {
    const req: TaskCreateRequest = { prompt, capabilities, ...opts }
    return ipcRenderer.invoke(IPC.taskCreate, req)
  },
  taskApprove: (taskId: string): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskApprove, { taskId }),
  taskCancel: (taskId: string): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskCancel, { taskId }),
  taskPause: (taskId: string): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskPause, { taskId }),
  taskResume: (taskId: string): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskResume, { taskId }),
  taskGet: (taskId: string): Promise<Task> =>
    ipcRenderer.invoke(IPC.taskGet, { taskId }),
  taskList: (): Promise<TaskListResponse> =>
    ipcRenderer.invoke(IPC.taskList),
  taskDelete: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.taskDelete, { taskId }),
  onTaskUpdate: (cb: (task: Task) => void): (() => void) => {
    const handler = (_evt: unknown, payload: TaskUpdateEvent): void => cb(payload.task)
    ipcRenderer.on('netbot:task:update', handler)
    return () => ipcRenderer.off('netbot:task:update', handler)
  },
  onWindowMaximized: (cb: (maximized: boolean) => void): (() => void) => {
    const handler = (_evt: unknown, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('netbot:window:maximized', handler)
    return () => ipcRenderer.off('netbot:window:maximized', handler)
  }
}

if (!process.contextIsolated) {
  throw new Error('Netbot requires contextIsolation')
}

contextBridge.exposeInMainWorld('netbot', netbot)
