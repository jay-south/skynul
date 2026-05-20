import type { Task, TaskCreateRequest } from '@skynul/shared'
import { api } from '@/lib/api'

export async function fetchTasks(): Promise<Task[]> {
  const res = await api<{ tasks: Task[] }>('/tasks')
  return res.tasks
}

export async function fetchTask(id: string): Promise<Task> {
  return api(`/tasks/${id}`)
}

export async function createTask(data: TaskCreateRequest): Promise<Task> {
  const res = await api<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.task
}

export async function approveTask(id: string): Promise<Task> {
  const res = await api<{ task: Task }>(`/tasks/${id}/approve`, { method: 'POST' })
  return res.task
}

export async function cancelTask(id: string): Promise<Task> {
  const res = await api<{ task: Task }>(`/tasks/${id}/cancel`, { method: 'POST' })
  return res.task
}

export async function deleteTask(id: string): Promise<void> {
  await api(`/tasks/${id}`, { method: 'DELETE' })
}

export async function sendTaskMessage(id: string, message: string): Promise<void> {
  await api(`/tasks/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
}
