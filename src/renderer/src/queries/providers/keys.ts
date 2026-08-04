export const providersKeys = {
  all: ['providers'] as const,
  credentials: (id: string) => [...providersKeys.all, 'credentials', id] as const
}
