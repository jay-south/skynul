import { useMutation } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { modelSettingsKeys } from '../settings/model/keys'
import { putProviderCredentials } from './service'
import type { ProviderId } from './types'

export function useSetProviderApiKey() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ providerId, apiKey }: { providerId: ProviderId; apiKey: string }) =>
      putProviderCredentials(providerId, { apiKey }),
    onSuccess: () => invalidate(modelSettingsKeys.detail())
  })
}
