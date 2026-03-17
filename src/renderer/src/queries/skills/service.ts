import type { Skill } from '../../../../shared/skill'

const API_BASE = 'http://localhost:3141/api'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}

export async function fetchSkills(): Promise<Skill[]> {
  return api('/skills')
}

export async function saveSkill(skill: Partial<Skill>): Promise<Skill[]> {
  return api('/skills', {
    method: 'POST',
    body: JSON.stringify(skill)
  })
}

export async function toggleSkill(id: string): Promise<Skill[]> {
  return api(`/skills/${id}/toggle`, { method: 'POST' })
}

export async function deleteSkill(id: string): Promise<Skill[]> {
  return api(`/skills/${id}`, { method: 'DELETE' })
}

export async function importSkill(filePath: string): Promise<Skill[]> {
  return api('/skills/import', {
    method: 'POST',
    body: JSON.stringify({ filePath })
  })
}
