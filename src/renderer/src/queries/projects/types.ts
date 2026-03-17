import type { ProjectWithTasks } from '../../../../shared/project'

export type ProjectCreateRequest = {
  name: string
}

export type ProjectListResponse = ProjectWithTasks[]
