import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../../invalidation'
import { permissionsSettingsKeys } from './keys'
import { fetchPermissionsSettings, patchPermission } from './service'
import type { PermissionKey, PermissionLevel } from './types'

export function usePermissionsSettings() {
  return useQuery({
    queryKey: permissionsSettingsKeys.detail(),
    queryFn: fetchPermissionsSettings
  })
}

function useInvalidatePermissionsSettings() {
  const invalidate = useInvalidate()
  return () => invalidate(permissionsSettingsKeys.detail())
}

export function useSetPermission() {
  const invalidate = useInvalidatePermissionsSettings()
  return useMutation({
    mutationFn: ({ key, level }: { key: PermissionKey; level: PermissionLevel }) =>
      patchPermission(key, level),
    onSuccess: invalidate
  })
}

export { useSetPermission as useSetCapability }
