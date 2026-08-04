import type {
  ChannelSettings as ChannelSettingsGenerated,
  GeneralSettings as GeneralSettingsGenerated,
  ModelSettings as ModelSettingsGenerated,
  ProviderSummary as ProviderSummaryGenerated,
  TaskCancelResponse as TaskCancelResponseGenerated,
  TaskCreatedResponse as TaskCreatedResponseGenerated,
  TaskCreateRequest as TaskCreateRequestGenerated,
  TaskResponse as TaskResponseGenerated
} from './generated'
import {
  CapabilityId as CapabilityIdEnum,
  ChannelId as ChannelIdEnum,
  ChannelStatus as ChannelStatusEnum,
  LanguageCode as LanguageCodeEnum,
  ModeSource as ModeSourceEnum,
  ProviderId as ProviderIdEnum,
  ScheduleFrequency as ScheduleFrequencyEnum,
  TaskMode as TaskModeEnum,
  TaskSource as TaskSourceEnum,
  TaskStatus as TaskStatusEnum,
  ThemeMode as ThemeModeEnum
} from './generated'

export type {
  ChannelListResponse,
  OkResponse,
  PairingCodeResponse,
  PatchGeneralSettings,
  PatchModelSettings,
  PatchPermissionsSettings,
  PermissionLevel,
  PermissionsSettings,
  Project,
  ProjectSummary,
  PutProviderCredentials,
  RuntimeAppStats,
  RuntimeStats,
  RuntimeSystemStats,
  Schedule,
  ScheduleListResponse,
  TaskListResponse,
  ToolApprovalRequest
} from './generated'

export type CapabilityId = `${CapabilityIdEnum}`
export type LanguageCode = `${LanguageCodeEnum}`
export type ThemeMode = `${ThemeModeEnum}`
export type ProviderId = `${ProviderIdEnum}`
export type ChannelId = `${ChannelIdEnum}`
export type ChannelStatus = `${ChannelStatusEnum}`
export type ScheduleFrequency = `${ScheduleFrequencyEnum}`
export type TaskStatus = `${TaskStatusEnum}`
export type TaskMode = `${TaskModeEnum}`
export type TaskSource = `${TaskSourceEnum}`
export type ModeSource = `${ModeSourceEnum}`

export type GeneralSettings = Omit<GeneralSettingsGenerated, 'language' | 'themeMode'> & {
  language: LanguageCode
  themeMode: ThemeMode
}

export type ProviderSummary = Omit<ProviderSummaryGenerated, 'id'> & {
  id: ProviderId
}

export type ProviderListItem = Omit<import('./generated').ProviderListItem, 'id'> & {
  id: ProviderId
}

export type ModelSettings = Omit<ModelSettingsGenerated, 'activeProvider' | 'model' | 'providers'> & {
  activeProvider: ProviderId
  model: string | null
  providers: ProviderSummary[]
}

export type ChannelSettings = Omit<
  ChannelSettingsGenerated,
  'id' | 'status' | 'pairingCode' | 'error'
> & {
  id: ChannelId
  status: ChannelStatus
  pairingCode: string | null
  error: string | null
}

export type TaskCreateRequest = TaskCreateRequestGenerated

export type TaskContinueRequest = import('./generated').TaskContinueRequest

export type TaskMessageResponse = import('./generated').TaskMessageResponse

export type TaskResponse = Omit<TaskResponseGenerated, 'status'> & {
  status: TaskStatus
}

export type TaskCreatedResponse = Omit<TaskCreatedResponseGenerated, 'status'> & {
  status: TaskStatus
}

export type TaskCancelResponse = Omit<TaskCancelResponseGenerated, 'status'> & {
  status: TaskStatus
}

export type PermissionKey = keyof import('./generated').PermissionsSettings

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'midnight', 'forest']

export const CAPABILITY_PERMISSION_KEY: Record<CapabilityId, PermissionKey> = {
  'fs.read': 'fsRead',
  'fs.write': 'fsWrite',
  'cmd.run': 'cmdRun',
  'net.http': 'netHttp'
}

export type TaskStreamStep = {
  tool: string
  label: string
  ok: boolean
}

export type TaskStreamPendingApproval = {
  requestId: string
  tool: string
  label: string
}

export type TaskStreamEvent =
  | { event: 'status_change'; status: TaskStatus }
  | { event: 'delta'; text: string }
  | { event: 'message'; text: string }
  | { event: 'step'; tool: string; label: string; ok: boolean }
  | { event: 'permission_request'; requestId: string; tool: string; label: string }
  | { event: 'error'; message: string }
  | { event: 'done' }
