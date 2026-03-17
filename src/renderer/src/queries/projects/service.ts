import type { ProjectWithTasks } from '../../../../shared/project'

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

export async function fetchProjects(): Promise<ProjectWithTasks[]> {
  return api('/projects')
}

export async function createProject(name: string): Promise<ProjectWithTasks> {
  return api('/projects', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

export async function addTaskToProject(projectId: string, taskId: string): Promise<void> {
  return api(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ taskId })
  })
}

export async function deleteProject(id: string): Promise<void> {
  return api(`/projects/${id}`, { method: 'DELETE' })
}
