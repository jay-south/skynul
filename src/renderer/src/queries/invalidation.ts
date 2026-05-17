import { useQueryClient } from '@tanstack/react-query'

export function useInvalidate() {
  const queryClient = useQueryClient()

  return (...keys: Array<readonly unknown[]>): void => {
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key as unknown[] })
    }
  }
}
