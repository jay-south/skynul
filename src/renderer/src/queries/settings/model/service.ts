import type { ModelSettings, PatchModelSettings } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchModelSettings(): Promise<ModelSettings> {
  return apiV1('/settings/model') as Promise<ModelSettings>
}

export async function patchModelSettings(data: PatchModelSettings): Promise<ModelSettings> {
  return apiV1('/settings/model', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }) as Promise<ModelSettings>
}
