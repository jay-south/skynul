import type { Skill } from '@skynul/shared'
import { apiFetch } from '@/lib/api-fetch'

export async function fetchSkills(): Promise<Skill[]> {
  return apiFetch('/skills')
}

export async function saveSkill(skill: Partial<Skill>): Promise<Skill[]> {
  return apiFetch('/skills', {
    method: 'POST',
    body: JSON.stringify(skill)
  })
}

export async function toggleSkill(id: string): Promise<Skill[]> {
  return apiFetch(`/skills/${id}/toggle`, { method: 'POST' })
}

export async function deleteSkill(id: string): Promise<Skill[]> {
  return apiFetch(`/skills/${id}`, { method: 'DELETE' })
}
