import type { Schedule } from '@skynul/shared'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'

export function list(): Schedule[] {
  return getDb().select().from(schema.schedules).all().map(rowToSchedule)
}

export function getById(id: string): Schedule | undefined {
  const row = getDb().select().from(schema.schedules).where(eq(schema.schedules.id, id)).get()
  return row ? rowToSchedule(row) : undefined
}

export function create(prompt: string, capabilities: string, mode: string, frequency: string, cronExpr: string, now: number): Schedule {
  const id = createId()
  getDb().insert(schema.schedules).values({
    id, prompt, capabilities, mode, frequency, cronExpr, enabled: true, lastRunAt: null, nextRunAt: now, createdAt: now
  }).run()
  return { id, prompt, capabilities: JSON.parse(capabilities), mode: mode as Schedule['mode'], frequency: frequency as Schedule['frequency'], cronExpr, enabled: true, lastRunAt: null, nextRunAt: now, createdAt: now }
}

export function update(id: string, data: Partial<Schedule>): void {
  const updates: Record<string, unknown> = {}
  if (data.prompt !== undefined) updates.prompt = data.prompt
  if (data.frequency !== undefined) updates.frequency = data.frequency
  if (data.cronExpr !== undefined) updates.cron_expr = data.cronExpr
  if (data.enabled !== undefined) updates.enabled = data.enabled
  if (data.mode !== undefined) updates.mode = data.mode
  if (data.capabilities !== undefined) updates.capabilities = JSON.stringify(data.capabilities)
  if (Object.keys(updates).length > 0) {
    getDb().update(schema.schedules).set(updates).where(eq(schema.schedules.id, id)).run()
  }
}

export function toggle(id: string): void {
  const existing = getById(id)
  if (existing) update(id, { enabled: !existing.enabled })
}

export function remove(id: string): void {
  getDb().delete(schema.schedules).where(eq(schema.schedules.id, id)).run()
}

export function createId(): string { return `sched_${randomBytes(4).toString('hex')}` }

type ScheduleRow = typeof schema.schedules.$inferSelect
function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id, prompt: row.prompt, capabilities: JSON.parse(row.capabilities),
    mode: row.mode as Schedule['mode'], frequency: row.frequency as Schedule['frequency'],
    cronExpr: row.cronExpr, enabled: row.enabled, lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt, createdAt: row.createdAt
  }
}
