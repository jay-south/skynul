import type {
  TaskCancelResponse,
  TaskCreateRequest,
  TaskCreatedResponse,
  TaskListResponse,
  TaskResponse
} from '@shared'
import { apiV1 } from '@/lib/api'

export type TaskListParams = {
  limit?: number
  offset?: number
  projectId?: string
}

export async function fetchTasks(params?: TaskListParams): Promise<TaskResponse[]> {
  const search = new URLSearchParams()
  search.set('limit', String(params?.limit ?? 100))
  if (params?.offset !== undefined) search.set('offset', String(params.offset))
  if (params?.projectId) search.set('projectId', params.projectId)
  const qs = search.toString()
  const res = await apiV1<TaskListResponse>(`/tasks${qs ? `?${qs}` : ''}`)
  return (res.items ?? []) as TaskResponse[]
}

export async function fetchTask(id: string): Promise<TaskResponse> {
  return apiV1<TaskResponse>(`/tasks/${id}`) as Promise<TaskResponse>
}

export async function createTask(data: TaskCreateRequest): Promise<TaskCreatedResponse> {
  return apiV1<TaskCreatedResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }) as Promise<TaskCreatedResponse>
}

export async function continueTask(
  id: string,
  data: import('@shared').TaskContinueRequest
): Promise<TaskCreatedResponse> {
  return apiV1<TaskCreatedResponse>(`/tasks/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(data)
  }) as Promise<TaskCreatedResponse>
}

export async function cancelTask(id: string): Promise<TaskCancelResponse> {
  return apiV1<TaskCancelResponse>(`/tasks/${id}/cancel`, {
    method: 'POST'
  }) as Promise<TaskCancelResponse>
}

export async function deleteTask(id: string): Promise<void> {
  await apiV1(`/tasks/${id}`, { method: 'DELETE' })
}

export async function approveToolCall(
  taskId: string,
  requestId: string,
  approved: boolean
): Promise<void> {
  await apiV1(`/tasks/${taskId}/tool-approval`, {
    method: 'POST',
    body: JSON.stringify({ requestId, approved })
  })
}
