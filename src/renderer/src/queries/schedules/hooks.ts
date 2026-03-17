import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { schedulesKeys } from './keys'
import { createSchedule, deleteSchedule, fetchSchedules, toggleSchedule } from './service'

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useSchedules() {
  return useQuery({
    queryKey: schedulesKeys.lists(),
    queryFn: fetchSchedules
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() })
    }
  })
}

export function useToggleSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: toggleSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() })
    }
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() })
    }
  })
}
