import type { TaskMessageResponse } from '@shared'
import { useMemo } from 'react'
import { useTask } from './hooks'
import { useTaskStreams } from './use-task-streams'
import { conversationMessages, isTaskLive, awaitingAssistantReply } from './utils'

export function useConversation(taskId: string | undefined) {
  const { data: task, isLoading } = useTask(taskId)

  const liveTaskIds = useMemo(
    () => (taskId && task && isTaskLive(task.status) ? [taskId] : []),
    [task, taskId]
  )
  const streams = useTaskStreams(liveTaskIds)
  const stream = taskId ? streams[taskId] : undefined

  const thread = useMemo((): TaskMessageResponse[] => {
    if (!task) return []
    return conversationMessages(task)
  }, [task])

  return {
    task,
    thread,
    stream,
    awaitingReply: task ? awaitingAssistantReply(task) : false,
    isRunning: task ? isTaskLive(task.status) : false,
    isLoading: isLoading && !task
  }
}
