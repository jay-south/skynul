export const modelSettingsKeys = {
  all: ['settings', 'model'] as const,
  detail: () => [...modelSettingsKeys.all] as const
}
