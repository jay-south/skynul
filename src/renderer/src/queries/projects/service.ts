import type { ProjectWithTasks } from '@skynul/shared'
import { api } from '@/lib/api'

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
