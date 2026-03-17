import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useTasks() {
  return useQuery({
    queryKey: tasksKeys.lists(),
    queryFn: fetchTasks
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: tasksKeys.detail(id || ''),
    queryFn: () => fetchTask(id!),
    enabled: !!id
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
    }
  })
}

export function useApproveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveTask,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
    }
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelTask,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
    }
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
    }
  })
}

export function useSendTaskMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => sendTaskMessage(id, message),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: tasksKeys.detail(id) })
    }
  })
}
