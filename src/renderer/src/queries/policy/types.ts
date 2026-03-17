import type {
  PolicyState,
  LanguageCode,
  ThemeMode,
  CapabilityId,
  ProviderId
} from '@skynul/shared'

export type PolicyResponse = PolicyState

export type SetLanguageRequest = {
  language: LanguageCode
}

export type SetThemeRequest = {
  themeMode: ThemeMode
}

export type SetCapabilityRequest = {
  capability: CapabilityId
  enabled: boolean
}

export type SetTaskMemoryRequest = {
  enabled: boolean
}

export type SetAutoApproveRequest = {
  enabled: boolean
}

export type SetProviderRequest = {
  providerId: ProviderId
}
