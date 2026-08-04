export const generalSettingsKeys = {
  all: ['settings', 'general'] as const,
  detail: () => [...generalSettingsKeys.all] as const
}
