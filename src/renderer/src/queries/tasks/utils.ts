import type { TaskMessageResponse, TaskResponse, TaskStatus } from '@shared'

const LIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['running'])

export function isTaskLive(status: TaskStatus | undefined): boolean {
  return status !== undefined && LIVE_TASK_STATUSES.has(status)
}

export function canContinueTask(status: TaskStatus | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function taskCreatedAtMs(task: Pick<TaskResponse, 'createdAt'>): number {
  const ms = Date.parse(task.createdAt)
  return Number.isNaN(ms) ? 0 : ms
}

export function taskUpdatedAtMs(task: Pick<TaskResponse, 'updatedAt' | 'createdAt'>): number {
  const updated = Date.parse(task.updatedAt)
  if (!Number.isNaN(updated)) return updated
  return taskCreatedAtMs(task)
}

export function conversationMessages(task: TaskResponse): TaskMessageResponse[] {
  if (task.messages?.length) return task.messages

  const thread: TaskMessageResponse[] = [
    { role: 'user', content: task.prompt, createdAt: task.createdAt }
  ]
  if (task.summary?.trim()) {
    thread.push({
      role: 'assistant',
      content: task.summary,
      createdAt: task.updatedAt ?? task.createdAt,
      steps: task.steps
    })
  } else if (task.error?.trim()) {
    thread.push({
      role: 'assistant',
      content: task.error,
      createdAt: task.updatedAt ?? task.createdAt,
      error: true
    })
  }
  return thread
}

export function awaitingAssistantReply(task: TaskResponse): boolean {
  const last = conversationMessages(task).at(-1)
  return isTaskLive(task.status) && last?.role === 'user'
}

export const TASK_POLL_MS = 5000
