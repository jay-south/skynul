import type { Task } from '@skynul/shared'
import { eq } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../db'

export function list(): Task[] {
  return getDb().select().from(schema.tasks).all().map(rowToTask)
}

export function getById(id: string): Task | undefined {
  const row = getDb().select().from(schema.tasks).where(eq(schema.tasks.id, id)).get()
  return row ? rowToTask(row) : undefined
}

export function create(task: Task): void {
  getDb().insert(schema.tasks).values({
    id: task.id, parentTaskId: task.parentTaskId ?? null, agentName: task.agentName ?? null,
    agentRole: task.agentRole ?? null, prompt: task.prompt,
    attachments: task.attachments ? JSON.stringify(task.attachments) : null,
    status: task.status, mode: task.mode, capabilities: JSON.stringify(task.capabilities),
    steps: JSON.stringify(task.steps), usage: task.usage ? JSON.stringify(task.usage) : null,
    createdAt: task.createdAt, updatedAt: task.updatedAt, maxSteps: task.maxSteps,
    timeoutMs: task.timeoutMs, error: task.error ?? null, summary: task.summary ?? null,
    source: task.source ?? null
  }).run()
}

export function update(id: string, data: Partial<Task>): void {
  const updates: Record<string, unknown> = {}
  if (data.parentTaskId !== undefined) updates.parent_task_id = data.parentTaskId
  if (data.agentName !== undefined) updates.agent_name = data.agentName
  if (data.agentRole !== undefined) updates.agent_role = data.agentRole
  if (data.prompt !== undefined) updates.prompt = data.prompt
  if (data.attachments !== undefined) updates.attachments = JSON.stringify(data.attachments)
  if (data.status !== undefined) updates.status = data.status
  if (data.mode !== undefined) updates.mode = data.mode
  if (data.capabilities !== undefined) updates.capabilities = JSON.stringify(data.capabilities)
  if (data.steps !== undefined) updates.steps = JSON.stringify(data.steps)
  if (data.usage !== undefined) updates.usage = JSON.stringify(data.usage)
  if (data.createdAt !== undefined) updates.created_at = data.createdAt
  if (data.updatedAt !== undefined) updates.updated_at = data.updatedAt
  if (data.maxSteps !== undefined) updates.max_steps = data.maxSteps
  if (data.timeoutMs !== undefined) updates.timeout_ms = data.timeoutMs
  if (data.error !== undefined) updates.error = data.error
  if (data.summary !== undefined) updates.summary = data.summary
  if (data.source !== undefined) updates.source = data.source
  if (Object.keys(updates).length > 0) {
    getDb().update(schema.tasks).set(updates).where(eq(schema.tasks.id, id)).run()
  }
}

export function remove(id: string): void {
  getDb().delete(schema.tasks).where(eq(schema.tasks.id, id)).run()
}

export function appendStep(id: string, step: import('@skynul/shared').TaskStep): void {
  getSqlite().prepare(`UPDATE tasks SET steps = json_insert(steps, '$[#]', json(?) ), updated_at = ? WHERE id = ?`).run(JSON.stringify(step), Date.now(), id)
}

export function listActive(): Task[] {
  return getDb().select().from(schema.tasks).where(eq(schema.tasks.status, 'running')).all().map(rowToTask)
}

type TaskRow = typeof schema.tasks.$inferSelect

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id, parentTaskId: row.parentTaskId ?? undefined, agentName: row.agentName ?? undefined,
    agentRole: row.agentRole ?? undefined, prompt: row.prompt,
    attachments: row.attachments ? JSON.parse(row.attachments) as string[] : undefined,
    status: row.status as Task['status'], mode: row.mode as Task['mode'],
    capabilities: JSON.parse(row.capabilities) as Task['capabilities'],
    steps: JSON.parse(row.steps) as Task['steps'],
    usage: row.usage ? JSON.parse(row.usage) as Task['usage'] : undefined,
    createdAt: row.createdAt, updatedAt: row.updatedAt, maxSteps: row.maxSteps,
    timeoutMs: row.timeoutMs, error: row.error ?? undefined, summary: row.summary ?? undefined,
    source: row.source as Task['source']
  }
}
