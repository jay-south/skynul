import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { skillsKeys } from './keys'
import { deleteSkill, fetchSkills, importSkill, saveSkill, toggleSkill } from './service'

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useSkills() {
  return useQuery({
    queryKey: skillsKeys.lists(),
    queryFn: fetchSkills
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useSaveSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() })
    }
  })
}

export function useToggleSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: toggleSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() })
    }
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() })
    }
  })
}

export function useImportSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() })
    }
  })
}
