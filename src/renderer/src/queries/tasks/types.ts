import type { Task, TaskCapabilityId } from '../../../../shared/task'

export type TaskListResponse = {
  tasks: Task[]
}

export type TaskCreateRequest = {
  prompt: string
  capabilities: TaskCapabilityId[]
  mode?: 'browser' | 'code'
  maxSteps?: number
  timeoutMs?: number
  attachments?: string[]
}

export type TaskCreateResponse = {
  task: Task
}

export type TaskMessageRequest = {
  message: string
}
