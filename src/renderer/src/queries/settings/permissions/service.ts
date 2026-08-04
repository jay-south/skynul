import type { PatchPermissionsSettings, PermissionKey, PermissionLevel, PermissionsSettings } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchPermissionsSettings(): Promise<PermissionsSettings> {
  return apiV1('/settings/permissions')
}

export async function patchPermissionsSettings(
  data: PatchPermissionsSettings
): Promise<PermissionsSettings> {
  return apiV1('/settings/permissions', {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function patchPermission(
  key: PermissionKey,
  level: PermissionLevel
): Promise<PermissionsSettings> {
  return patchPermissionsSettings({ [key]: level })
}
