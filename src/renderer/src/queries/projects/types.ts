export type { Project, ProjectSummary } from '@shared'

export type CreateProjectRequest = {
  name: string
  color?: string
}

export type AddTaskToProjectRequest = {
  projectId: string
  taskId: string
}
