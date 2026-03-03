import type { CapabilityId, LanguageCode, PolicyState, ThemeMode } from '../shared/policy'
import type { Task, TaskCapabilityId, TaskCreateResponse, TaskListResponse } from '../shared/task'
import type { RuntimeStats } from '../shared/runtime'

declare global {
  interface Window {
    skynul: {
      ping: () => Promise<string>
      runtimeGetStats: () => Promise<RuntimeStats>
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
        opts?: { mode?: 'browser' | 'code'; maxSteps?: number; timeoutMs?: number }
      ) => Promise<TaskCreateResponse>
      taskApprove: (taskId: string) => Promise<Task>
      taskCancel: (taskId: string) => Promise<Task>
      taskPause: (taskId: string) => Promise<Task>
      taskResume: (taskId: string) => Promise<Task>
      taskGet: (taskId: string) => Promise<Task>
      taskList: () => Promise<TaskListResponse>
      taskDelete: (taskId: string) => Promise<boolean>
      taskSendMessage: (taskId: string, message: string) => Promise<boolean>
      onTaskUpdate: (cb: (task: Task) => void) => () => void
      onWindowMaximized: (cb: (maximized: boolean) => void) => () => void

      setTaskMemoryEnabled: (enabled: boolean) => Promise<PolicyState>
      setTaskAutoApprove: (enabled: boolean) => Promise<PolicyState>

      // Skills
      skillList: () => Promise<import('../shared/skill').Skill[]>
      skillSave: (skill: Record<string, unknown>) => Promise<import('../shared/skill').Skill[]>
      skillDelete: (id: string) => Promise<import('../shared/skill').Skill[]>
      skillToggle: (id: string) => Promise<import('../shared/skill').Skill[]>
      skillImport: (filePath: string) => Promise<import('../shared/skill').Skill[]>

      // Channels
      channelGetAll: () => Promise<import('../shared/channel').ChannelSettings[]>
      channelGetSettings: (
        channelId: import('../shared/channel').ChannelId
      ) => Promise<import('../shared/channel').ChannelSettings>
      channelSetEnabled: (
        channelId: import('../shared/channel').ChannelId,
        enabled: boolean
      ) => Promise<import('../shared/channel').ChannelSettings>
      channelSetCredentials: (
        channelId: import('../shared/channel').ChannelId,
        creds: Record<string, string>
      ) => Promise<import('../shared/channel').ChannelSettings>
      channelGeneratePairing: (channelId: import('../shared/channel').ChannelId) => Promise<string>
      channelUnpair: (
        channelId: import('../shared/channel').ChannelId
      ) => Promise<import('../shared/channel').ChannelSettings>
      channelGetGlobal: () => Promise<import('../shared/channel').ChannelGlobalSettings>
      channelSetAutoApprove: (
        val: boolean
      ) => Promise<import('../shared/channel').ChannelGlobalSettings>

      // Schedules
      scheduleList: () => Promise<import('../shared/schedule').Schedule[]>
      scheduleSave: (
        sched: Record<string, unknown>
      ) => Promise<import('../shared/schedule').Schedule[]>
      scheduleDelete: (id: string) => Promise<import('../shared/schedule').Schedule[]>
      scheduleToggle: (id: string) => Promise<import('../shared/schedule').Schedule[]>

      // Audio Transcription
      transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<string>

      // Browser Snapshots
      browserSnapshotList: () => Promise<import('../main/browser-snapshots').BrowserSnapshot[]>
      browserSnapshotSave: (
        name: string
      ) => Promise<import('../main/browser-snapshots').BrowserSnapshot>
      browserSnapshotRestore: (id: string) => Promise<{ success: boolean }>
      browserSnapshotDelete: (id: string) => Promise<boolean>

      // Secrets
      getSecret: (key: string) => Promise<string | null>
      setSecret: (key: string, value: string) => Promise<void>
    }
  }
}
