import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'

export function keys(): string[] {
  return getDb().select({ key: schema.secrets.key }).from(schema.secrets).all().map((r) => r.key)
}

export function get(key: string): string | undefined {
  const row = getDb().select().from(schema.secrets).where(eq(schema.secrets.key, key)).get()
  return row?.value
}

export function set(key: string, value: string): void {
  const existing = getDb().select().from(schema.secrets).where(eq(schema.secrets.key, key)).get()
  if (existing) {
    getDb().update(schema.secrets).set({ value, updatedAt: Date.now() }).where(eq(schema.secrets.key, key)).run()
  } else {
    getDb().insert(schema.secrets).values({ key, value, updatedAt: Date.now() }).run()
  }
}

export function has(key: string): boolean {
  return !!getDb().select().from(schema.secrets).where(eq(schema.secrets.key, key)).get()
}

export function remove(key: string): void {
  getDb().delete(schema.secrets).where(eq(schema.secrets.key, key)).run()
}
