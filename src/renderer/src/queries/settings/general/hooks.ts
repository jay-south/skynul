import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../../invalidation'
import { generalSettingsKeys } from './keys'
import { fetchGeneralSettings, patchGeneralSettings } from './service'
import type { LanguageCode, PatchGeneralSettings, ThemeMode } from './types'

export function useGeneralSettings() {
  return useQuery({
    queryKey: generalSettingsKeys.detail(),
    queryFn: fetchGeneralSettings
  })
}

function useInvalidateGeneralSettings() {
  const invalidate = useInvalidate()
  return () => invalidate(generalSettingsKeys.detail())
}

export function usePatchGeneralSettings() {
  const invalidate = useInvalidateGeneralSettings()
  return useMutation({
    mutationFn: (data: PatchGeneralSettings) => patchGeneralSettings(data),
    onSuccess: invalidate
  })
}

export function useSetLanguage() {
  const invalidate = useInvalidateGeneralSettings()
  return useMutation({
    mutationFn: (language: LanguageCode) => patchGeneralSettings({ language }),
    onSuccess: invalidate
  })
}

export function useSetTheme() {
  const invalidate = useInvalidateGeneralSettings()
  return useMutation({
    mutationFn: (themeMode: ThemeMode) => patchGeneralSettings({ themeMode }),
    onSuccess: invalidate
  })
}

export function useSetAgentPromptAppend() {
  const invalidate = useInvalidateGeneralSettings()
  return useMutation({
    mutationFn: (agentPromptAppend: string) => patchGeneralSettings({ agentPromptAppend }),
    onSuccess: invalidate
  })
}
