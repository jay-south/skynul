export const runtimeKeys = {
  all: ['runtime'] as const,
  stats: () => [...runtimeKeys.all, 'stats'] as const
}
