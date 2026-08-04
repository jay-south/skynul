import type { GeneralSettings, PatchGeneralSettings } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchGeneralSettings(): Promise<GeneralSettings> {
  return apiV1('/settings/general') as Promise<GeneralSettings>
}

export async function patchGeneralSettings(
  data: PatchGeneralSettings
): Promise<GeneralSettings> {
  return apiV1('/settings/general', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }) as Promise<GeneralSettings>
}
