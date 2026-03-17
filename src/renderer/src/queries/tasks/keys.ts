export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (filters: string) => [...tasksKeys.lists(), { filters }] as const,
  details: () => [...tasksKeys.all, 'detail'] as const,
  detail: (id: string) => [...tasksKeys.details(), id] as const
}
