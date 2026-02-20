export type CapabilityId = 'fs.read' | 'fs.write' | 'cmd.run' | 'net.http'

export type ThemeMode = 'system' | 'light' | 'dark'

export type ProviderId = 'openai' | 'chatgpt'

export type PolicyState = {
  workspaceRoot: string | null
  capabilities: Record<CapabilityId, boolean>
  themeMode: ThemeMode
  provider: {
    active: ProviderId
    openaiModel: string
  }
}

export const DEFAULT_POLICY: PolicyState = {
  workspaceRoot: null,
  capabilities: {
    'fs.read': false,
    'fs.write': false,
    'cmd.run': false,
    'net.http': false
  },
  themeMode: 'dark',
  provider: {
    active: 'openai',
    openaiModel: 'gpt-4.1-mini'
  }
}

export type SetCapabilityRequest = {
  id: CapabilityId
  enabled: boolean
}

export type SetThemeRequest = {
  themeMode: ThemeMode
}

export type SetOpenAIModelRequest = {
  model: string
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ChatSendRequest = {
  messages: ChatMessage[]
}

export type ChatSendResponse = {
  content: string
}

export type ReadTextFileRequest = {
  /** Relative to workspaceRoot. */
  path: string
}

export type WriteTextFileRequest = {
  /** Relative to workspaceRoot. */
  path: string
  content: string
  ifExists?: 'fail' | 'overwrite'
}
