import type { TaskResponse } from '@shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { tasksKeys } from './keys'
import {
  cancelTask,
  continueTask,
  createTask,
  deleteTask,
  fetchTask,
  fetchTasks
} from './service'
import { conversationMessages, isTaskLive, TASK_POLL_MS } from './utils'

export function useTasks() {
  return useQuery({
    queryKey: tasksKeys.lists(),
    queryFn: () => fetchTasks(),
    refetchInterval: (query) => {
      const hasLiveTask =
        query.state.data?.some((task: TaskResponse) => isTaskLive(task.status)) ?? false
      return hasLiveTask ? TASK_POLL_MS : false
    },
    refetchIntervalInBackground: true
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: tasksKeys.detail(id || ''),
    queryFn: () => {
      if (id === undefined || id === '')
        throw new Error('useTask: id is required when the query runs')
      return fetchTask(id)
    },
    enabled: !!id,
    refetchInterval: false,
    placeholderData: (previous) => previous
  })
}

export function useCreateTask() {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTask,
    onSuccess: async (created) => {
      await queryClient.fetchQuery({
        queryKey: tasksKeys.detail(created.id),
        queryFn: () => fetchTask(created.id)
      })
      invalidate(tasksKeys.lists())
    }
  })
}

export function useContinueTask() {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & import('@shared').TaskContinueRequest) =>
      continueTask(id, body),
    onMutate: async ({ id, prompt }) => {
      await queryClient.cancelQueries({ queryKey: tasksKeys.detail(id) })
      const previous = queryClient.getQueryData<TaskResponse>(tasksKeys.detail(id))
      if (previous) {
        queryClient.setQueryData(tasksKeys.detail(id), {
          ...previous,
          status: 'running',
          summary: undefined,
          error: undefined,
          steps: undefined,
          messages: [
            ...conversationMessages(previous),
            { role: 'user', content: prompt, createdAt: new Date().toISOString() }
          ]
        })
      }
      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tasksKeys.detail(id), context.previous)
      }
    },
    onSuccess: () => {
      invalidate(tasksKeys.lists())
    }
  })
}

export function useCancelTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: cancelTask,
    onSuccess: (result) => invalidate(tasksKeys.detail(result.id), tasksKeys.lists())
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => invalidate(tasksKeys.lists())
  })
}
