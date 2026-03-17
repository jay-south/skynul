import type { ProjectWithTasks } from '@skynul/shared'

export type ProjectCreateRequest = {
  name: string
}

export type ProjectListResponse = ProjectWithTasks[]
