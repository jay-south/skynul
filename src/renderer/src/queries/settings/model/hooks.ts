import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../../invalidation'
import { modelSettingsKeys } from './keys'
import { fetchModelSettings, patchModelSettings } from './service'
import type { ProviderId } from './types'

export function useModelSettings() {
  return useQuery({
    queryKey: modelSettingsKeys.detail(),
    queryFn: fetchModelSettings
  })
}

function useInvalidateModelSettings() {
  const invalidate = useInvalidate()
  return () => invalidate(modelSettingsKeys.detail())
}

export function useSetProvider() {
  const invalidate = useInvalidateModelSettings()
  return useMutation({
    mutationFn: (activeProvider: ProviderId) => patchModelSettings({ activeProvider }),
    onSuccess: invalidate
  })
}

export function useSetProviderModel() {
  const invalidate = useInvalidateModelSettings()
  return useMutation({
    mutationFn: (model: string) => patchModelSettings({ model }),
    onSuccess: invalidate
  })
}
