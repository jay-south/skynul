import type { Skill } from '@skynul/shared'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'

export function list(): Skill[] {
  return getDb().select().from(schema.skills).all().map(rowToSkill)
}

export function getById(id: string): Skill | undefined {
  const row = getDb().select().from(schema.skills).where(eq(schema.skills.id, id)).get()
  return row ? rowToSkill(row) : undefined
}

export function create(name: string, tag: string, description: string, prompt: string, enabled = true): Skill {
  const id = createId(); const now = Date.now()
  getDb().insert(schema.skills).values({ id, name, tag, description, prompt, enabled, createdAt: now }).run()
  return { id, name, tag, description, prompt, enabled, createdAt: now }
}

export function update(id: string, data: Partial<Skill>): void {
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.tag !== undefined) updates.tag = data.tag
  if (data.description !== undefined) updates.description = data.description
  if (data.prompt !== undefined) updates.prompt = data.prompt
  if (data.enabled !== undefined) updates.enabled = data.enabled ? 1 : 0
  if (Object.keys(updates).length > 0) {
    getDb().update(schema.skills).set(updates).where(eq(schema.skills.id, id)).run()
  }
}

export function remove(id: string): void {
  getDb().delete(schema.skills).where(eq(schema.skills.id, id)).run()
}

export function createId(): string {
  return `skill_${randomBytes(4).toString('hex')}`
}

type SkillRow = typeof schema.skills.$inferSelect

function rowToSkill(row: SkillRow): Skill {
  return { id: row.id, name: row.name, tag: row.tag, description: row.description, prompt: row.prompt, enabled: row.enabled, createdAt: row.createdAt }
}
