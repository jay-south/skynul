import type { ProjectWithTasks } from '@skynul/shared'
import { eq, and } from 'drizzle-orm'
import { getDb, schema } from '../db'

export function list(): ProjectWithTasks[] {
  const rows = getDb().select().from(schema.projects).all()
  return rows.map((r) => {
    const tasks = getDb().select({ taskId: schema.projectTasks.taskId })
      .from(schema.projectTasks).where(eq(schema.projectTasks.projectId, r.id)).all()
    return rowToProject(r, tasks.map((t) => t.taskId))
  })
}

export function create(name: string, color = '#6366f1'): ProjectWithTasks {
  const id = crypto.randomUUID(); const now = Date.now()
  getDb().insert(schema.projects).values({ id, name, color, createdAt: now }).run()
  return { id, name, color, createdAt: now, taskIds: [] }
}

export function update(id: string, name: string, color: string): void {
  getDb().update(schema.projects).set({ name, color }).where(eq(schema.projects.id, id)).run()
}

export function remove(id: string): void {
  getDb().delete(schema.projectTasks).where(eq(schema.projectTasks.projectId, id)).run()
  getDb().delete(schema.projects).where(eq(schema.projects.id, id)).run()
}

export function addTask(projectId: string, taskId: string): void {
  getDb().insert(schema.projectTasks).values({ projectId, taskId, addedAt: Date.now() }).onConflictDoNothing().run()
}

export function removeTask(projectId: string, taskId: string): void {
  getDb().delete(schema.projectTasks).where(and(eq(schema.projectTasks.projectId, projectId), eq(schema.projectTasks.taskId, taskId))).run()
}

type ProjectRow = typeof schema.projects.$inferSelect

function rowToProject(row: ProjectRow, taskIds: string[]): ProjectWithTasks {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.createdAt, taskIds }
}
