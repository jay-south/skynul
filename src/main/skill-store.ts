import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import { randomBytes } from 'crypto'
import type { Skill } from '../shared/skill'

function filePath(): string {
  return join(app.getPath('userData'), 'skills.json')
}

export async function loadSkills(): Promise<Skill[]> {
  try {
    const raw = await readFile(filePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveSkills(skills: Skill[]): Promise<void> {
  const f = filePath()
  await mkdir(dirname(f), { recursive: true })
  await writeFile(f, JSON.stringify(skills, null, 2), 'utf8')
}

export function createSkillId(): string {
  return `skill_${randomBytes(4).toString('hex')}`
}

export function getActiveSkillPrompts(skills: Skill[], taskPrompt: string): string {
  const active = skills.filter((s) => s.enabled)
  if (active.length === 0) return ''

  const prompt = taskPrompt.toLowerCase()
  const relevant = active.filter((s) => {
    const words = `${s.tag} ${s.name} ${s.description}`.toLowerCase().split(/\s+/)
    return words.some((w) => w.length > 2 && prompt.includes(w))
  })

  if (relevant.length === 0) return ''
  const lines = relevant.map((s) => `[${s.tag}/${s.name}]: ${s.prompt}`)
  return `\n## Active Skills:\n${lines.join('\n')}\n`
}
