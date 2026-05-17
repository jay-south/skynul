import { useMutation, useQuery } from '@tanstack/react-query'
import { projectsKeys } from './keys'
import { useInvalidate } from '../invalidation'
import { createProject, deleteProject, fetchProjects } from './service'

export function useProjects() {
  return useQuery({ queryKey: projectsKeys.lists(), queryFn: fetchProjects })
}

export function useCreateProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: createProject, onSuccess: () => invalidate(projectsKeys.lists()) })
}

export function useDeleteProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteProject, onSuccess: () => invalidate(projectsKeys.lists()) })
}
