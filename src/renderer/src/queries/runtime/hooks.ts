import { useQuery } from '@tanstack/react-query'
import { runtimeKeys } from './keys'
import { fetchRuntimeStats } from './service'

export function useRuntimeStats() {
  return useQuery({
    queryKey: runtimeKeys.stats(),
    queryFn: fetchRuntimeStats,
    refetchInterval: 2000
  })
}
