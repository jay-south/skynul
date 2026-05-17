export const channelsKeys = {
  all: () => ['channels'] as const,
  lists: () => [...channelsKeys.all(), 'list'] as const,
  global: () => [...channelsKeys.all(), 'global'] as const
}
