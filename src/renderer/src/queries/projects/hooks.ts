import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsKeys } from './keys'
import { fetchProjects, createProject, deleteProject } from './service'

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useProjects() {
  return useQuery({
    queryKey: projectsKeys.lists(),
    queryFn: fetchProjects
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    }
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    }
  })
}
