import type { TaskStreamEvent, TaskStreamPendingApproval, TaskStreamStep } from '@shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { tasksKeys } from './keys'
import { fetchTask } from './service'
import { connectTaskStream } from './stream'

export type TaskStreamState = {
  draft: string
  steps: TaskStreamStep[]
  pendingApproval?: TaskStreamPendingApproval
}

export function useTaskStreams(taskIds: string[]): Record<string, TaskStreamState> {
  const queryClient = useQueryClient()
  const [streams, setStreams] = useState<Record<string, TaskStreamState>>({})
  const liveKey = taskIds.slice().sort().join('|')

  useEffect(() => {
    if (!liveKey) return

    const cleanups = taskIds.map((taskId) =>
      connectTaskStream(taskId, {
        onEvent: (event: TaskStreamEvent) => {
          if (event.event === 'delta') {
            setStreams((prev) => ({
              ...prev,
              [taskId]: {
                draft: (prev[taskId]?.draft ?? '') + event.text,
                steps: prev[taskId]?.steps ?? [],
                pendingApproval: prev[taskId]?.pendingApproval
              }
            }))
            return
          }
          if (event.event === 'message') {
            setStreams((prev) => ({
              ...prev,
              [taskId]: {
                draft: event.text,
                steps: prev[taskId]?.steps ?? [],
                pendingApproval: prev[taskId]?.pendingApproval
              }
            }))
            return
          }
          if (event.event === 'step') {
            setStreams((prev) => ({
              ...prev,
              [taskId]: {
                draft: prev[taskId]?.draft ?? '',
                pendingApproval: undefined,
                steps: [
                  ...(prev[taskId]?.steps ?? []),
                  { tool: event.tool, label: event.label, ok: event.ok }
                ]
              }
            }))
            return
          }
          if (event.event === 'permission_request') {
            setStreams((prev) => ({
              ...prev,
              [taskId]: {
                draft: prev[taskId]?.draft ?? '',
                steps: prev[taskId]?.steps ?? [],
                pendingApproval: {
                  requestId: event.requestId,
                  tool: event.tool,
                  label: event.label
                }
              }
            }))
            return
          }
          if (event.event === 'status_change' && event.status === 'running') {
            setStreams((prev) => ({
              ...prev,
              [taskId]: { draft: '', steps: [] }
            }))
            queryClient.setQueryData(tasksKeys.detail(taskId), (old: unknown) => {
              if (!old || typeof old !== 'object') return old
              return {
                ...old,
                status: event.status,
                summary: undefined,
                error: undefined,
                steps: undefined
              }
            })
            return
          }
          if (event.event === 'error') {
            void (async () => {
              try {
                const updated = await fetchTask(taskId)
                queryClient.setQueryData(tasksKeys.detail(taskId), updated)
              } finally {
                setStreams((prev) => {
                  const next = { ...prev }
                  delete next[taskId]
                  return next
                })
              }
              void queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
            })()
            return
          }
          if (event.event === 'done') {
            void (async () => {
              try {
                const updated = await fetchTask(taskId)
                queryClient.setQueryData(tasksKeys.detail(taskId), updated)
              } finally {
                setStreams((prev) => {
                  const next = { ...prev }
                  delete next[taskId]
                  return next
                })
              }
              void queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
            })()
          }
        }
      })
    )

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [liveKey, queryClient, taskIds])

  return streams
}
