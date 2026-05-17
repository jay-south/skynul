import { useMutation, useQuery } from '@tanstack/react-query'
import { skillsKeys } from './keys'
import { useInvalidate } from '../invalidation'
import { deleteSkill, fetchSkills, saveSkill, toggleSkill } from './service'

export function useSkills() {
  return useQuery({ queryKey: skillsKeys.lists(), queryFn: fetchSkills })
}

export function useSaveSkill() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: saveSkill, onSuccess: () => invalidate(skillsKeys.lists()) })
}

export function useToggleSkill() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: toggleSkill, onSuccess: () => invalidate(skillsKeys.lists()) })
}

export function useDeleteSkill() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteSkill, onSuccess: () => invalidate(skillsKeys.lists()) })
}
