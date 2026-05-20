import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { tasksKeys } from './keys'
import {
  approveTask,
  cancelTask,
  createTask,
  deleteTask,
  fetchTask,
  fetchTasks,
  sendTaskMessage
} from './service'

export function useTasks() {
  return useQuery({ queryKey: tasksKeys.lists(), queryFn: fetchTasks })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: tasksKeys.detail(id || ''),
    queryFn: () => {
      if (id === undefined || id === '')
        throw new Error('useTask: id is required when the query runs')
      return fetchTask(id)
    },
    enabled: !!id
  })
}

export function useCreateTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => invalidate(tasksKeys.lists())
  })
}

export function useApproveTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: approveTask,
    onSuccess: (_data, id) => invalidate(tasksKeys.detail(id), tasksKeys.lists())
  })
}

export function useCancelTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: cancelTask,
    onSuccess: (_data, id) => invalidate(tasksKeys.detail(id), tasksKeys.lists())
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => invalidate(tasksKeys.lists())
  })
}

export function useSendTaskMessage() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => sendTaskMessage(id, message),
    onSuccess: (_data, { id }) => invalidate(tasksKeys.detail(id))
  })
}
