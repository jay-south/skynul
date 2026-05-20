import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { projectsKeys } from './keys'
import { addTaskToProject, createProject, deleteProject, fetchProjects } from './service'

export function useProjects() {
  return useQuery({ queryKey: projectsKeys.lists(), queryFn: fetchProjects })
}

export function useCreateProject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => invalidate(projectsKeys.lists())
  })
}

export function useAddTaskToProject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      addTaskToProject(projectId, taskId),
    onSuccess: () => invalidate(projectsKeys.lists())
  })
}

export function useDeleteProject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => invalidate(projectsKeys.lists())
  })
}
