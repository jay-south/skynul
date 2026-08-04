export const permissionsSettingsKeys = {
  all: ['settings', 'permissions'] as const,
  detail: () => [...permissionsSettingsKeys.all] as const
}
