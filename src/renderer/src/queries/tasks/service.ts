import type { Task, TaskCreateRequest } from '@skynul/shared'
import { apiFetch } from '@/lib/api-fetch'

export async function fetchTasks(): Promise<Task[]> {
  const res = await apiFetch<{ tasks: Task[] }>('/tasks')
  return res.tasks
}

export async function fetchTask(id: string): Promise<Task> {
  return apiFetch(`/tasks/${id}`)
}

export async function createTask(data: TaskCreateRequest): Promise<Task> {
  const res = await apiFetch<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.task
}

export async function approveTask(id: string): Promise<Task> {
  const res = await apiFetch<{ task: Task }>(`/tasks/${id}/approve`, { method: 'POST' })
  return res.task
}

export async function cancelTask(id: string): Promise<Task> {
  const res = await apiFetch<{ task: Task }>(`/tasks/${id}/cancel`, { method: 'POST' })
  return res.task
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
}

export async function sendTaskMessage(id: string, message: string): Promise<void> {
  await apiFetch(`/tasks/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
}
