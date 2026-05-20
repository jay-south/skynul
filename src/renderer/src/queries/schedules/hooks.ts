import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { schedulesKeys } from './keys'
import { createSchedule, deleteSchedule, fetchSchedules, toggleSchedule } from './service'

export function useSchedules() {
  return useQuery({ queryKey: schedulesKeys.lists(), queryFn: fetchSchedules })
}

export function useCreateSchedule() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => invalidate(schedulesKeys.lists())
  })
}

export function useToggleSchedule() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: toggleSchedule,
    onSuccess: () => invalidate(schedulesKeys.lists())
  })
}

export function useDeleteSchedule() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => invalidate(schedulesKeys.lists())
  })
}
