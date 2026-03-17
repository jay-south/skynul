export const policyKeys = {
  all: ['policy'] as const,
  detail: () => [...policyKeys.all] as const
}
