import type { ProjectWithTasks } from '@skynul/shared'
import { apiFetch } from '@/lib/api-fetch'

export async function fetchProjects(): Promise<ProjectWithTasks[]> {
  return apiFetch('/projects')
}

export async function createProject(name: string): Promise<ProjectWithTasks> {
  return apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

export async function addTaskToProject(projectId: string, taskId: string): Promise<void> {
  return apiFetch(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ taskId })
  })
}

export async function deleteProject(id: string): Promise<void> {
  return apiFetch(`/projects/${id}`, { method: 'DELETE' })
}
