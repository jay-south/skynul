export const skillsKeys = {
  all: ['skills'] as const,
  lists: () => [...skillsKeys.all, 'list'] as const
}
