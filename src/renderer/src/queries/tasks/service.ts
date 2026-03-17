import type { Task } from '@skynul/shared'
import type { TaskListResponse, TaskCreateRequest, TaskCreateResponse } from './types'

const API_BASE = 'http://localhost:3141/api'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}

export async function fetchTasks(): Promise<TaskListResponse> {
  return api('/tasks')
}

export async function fetchTask(id: string): Promise<Task> {
  return api(`/tasks/${id}`)
}

export async function createTask(data: TaskCreateRequest): Promise<TaskCreateResponse> {
  return api('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function approveTask(id: string): Promise<{ task: Task }> {
  return api(`/tasks/${id}/approve`, { method: 'POST' })
}

export async function cancelTask(id: string): Promise<{ task: Task }> {
  return api(`/tasks/${id}/cancel`, { method: 'POST' })
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  return api(`/tasks/${id}`, { method: 'DELETE' })
}

export async function sendTaskMessage(id: string, message: string): Promise<{ ok: boolean }> {
  return api(`/tasks/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
}
