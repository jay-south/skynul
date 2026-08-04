import type { ProviderId, ProviderListItem, PutProviderCredentials } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchProviders(): Promise<ProviderListItem[]> {
  return apiV1('/providers') as Promise<ProviderListItem[]>
}

export async function putProviderCredentials(
  providerId: ProviderId,
  data: PutProviderCredentials
): Promise<{ id: ProviderId; configured: boolean }> {
  return apiV1(`/providers/${providerId}/credentials`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }) as Promise<{ id: ProviderId; configured: boolean }>
}

export async function deleteProviderCredentials(
  providerId: ProviderId
): Promise<{ id: ProviderId; configured: boolean }> {
  return apiV1(`/providers/${providerId}/credentials`, {
    method: 'DELETE'
  }) as Promise<{ id: ProviderId; configured: boolean }>
}
