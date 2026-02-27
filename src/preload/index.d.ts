import type { CapabilityId, LanguageCode, PolicyState, ThemeMode } from '../shared/policy'
import type { Task, TaskCapabilityId, TaskCreateResponse, TaskListResponse } from '../shared/task'

declare global {
  interface Window {
    netbot: {
      ping: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      authOpen: (url: string) => Promise<void>
      getPolicy: () => Promise<PolicyState>
      pickWorkspace: () => Promise<PolicyState>
      setCapability: (id: CapabilityId, enabled: boolean) => Promise<PolicyState>
      setTheme: (themeMode: ThemeMode) => Promise<PolicyState>
      setOpenAIModel: (model: string) => Promise<PolicyState>
      setOpenAIApiKey: (apiKey: string) => Promise<boolean>
      hasOpenAIApiKey: () => Promise<boolean>
      chatSend: (
        messages: Array<{ role: 'user' | 'assistant'; content: string }>
      ) => Promise<{ content: string }>
      fsReadText: (path: string) => Promise<string>
      fsWriteText: (path: string, content: string, ifExists?: 'fail' | 'overwrite') => Promise<void>
      onAuthCallback: (cb: (url: string) => void) => () => void
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      showOpenFilesDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      setActiveProvider: (id: string) => Promise<PolicyState>
      setProviderApiKey: (provider: string, apiKey: string) => Promise<boolean>
      hasProviderApiKey: (provider: string) => Promise<boolean>
      setLanguage: (language: LanguageCode) => Promise<PolicyState>
      chatgptOAuthStart: () => Promise<string>
      chatgptHasAuth: () => Promise<boolean>
      chatgptSignOut: () => Promise<boolean>
      onChatGPTAuthSuccess: (cb: () => void) => () => void
      onChatGPTAuthError: (cb: (message: string) => void) => () => void

      // Task Agent
      taskCreate: (
        prompt: string,
        capabilities: TaskCapabilityId[],
        opts?: { maxSteps?: number; timeoutMs?: number }
      ) => Promise<TaskCreateResponse>
      taskApprove: (taskId: string) => Promise<Task>
      taskCancel: (taskId: string) => Promise<Task>
      taskPause: (taskId: string) => Promise<Task>
      taskResume: (taskId: string) => Promise<Task>
      taskGet: (taskId: string) => Promise<Task>
      taskList: () => Promise<TaskListResponse>
      taskDelete: (taskId: string) => Promise<boolean>
      onTaskUpdate: (cb: (task: Task) => void) => () => void
      onWindowMaximized: (cb: (maximized: boolean) => void) => () => void

      setTaskMemoryEnabled: (enabled: boolean) => Promise<PolicyState>

      // Skills
      skillList: () => Promise<import('../shared/skill').Skill[]>
      skillSave: (skill: Record<string, unknown>) => Promise<import('../shared/skill').Skill[]>
      skillDelete: (id: string) => Promise<import('../shared/skill').Skill[]>
      skillToggle: (id: string) => Promise<import('../shared/skill').Skill[]>
      skillImport: (filePath: string) => Promise<import('../shared/skill').Skill[]>

      // Telegram
      telegramGetSettings: () => Promise<{
        enabled: boolean
        pairedChatId: number | null
        pairingCode: string | null
      }>
      telegramSetEnabled: (enabled: boolean) => Promise<{
        enabled: boolean
        pairedChatId: number | null
        pairingCode: string | null
      }>
      telegramSetToken: (token: string) => Promise<boolean>
      telegramGeneratePairingCode: () => Promise<string>
      telegramUnpair: () => Promise<boolean>

      // Secrets
      getSecret: (key: string) => Promise<string | null>
      setSecret: (key: string, value: string) => Promise<void>
    }
  }
}
