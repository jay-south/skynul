import type { CapabilityId, LanguageCode, ProviderId, ThemeMode } from '@skynul/shared'

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

export type SetAutoApproveRequest = {
  enabled: boolean
}

export type SetProviderRequest = {
  providerId: ProviderId
}
