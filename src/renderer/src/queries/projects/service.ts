import type { Project, ProjectSummary } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return apiV1('/projects') as Promise<ProjectSummary[]>
}

export async function createProject(data: { name: string; color?: string }): Promise<Project> {
  return apiV1('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }) as Promise<Project>
}

export async function updateProject(
  id: string,
  data: { name?: string; color?: string }
): Promise<Project> {
  return apiV1(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }) as Promise<Project>
}

export async function addTaskToProject(projectId: string, taskId: string): Promise<void> {
  await apiV1(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ taskId })
  })
}

export async function deleteProject(id: string): Promise<void> {
  await apiV1(`/projects/${id}`, { method: 'DELETE' })
}
