import { eq } from 'drizzle-orm'
import { DEFAULT_POLICY, type PolicyState, type ProviderId } from '@skynul/shared'
import { getDb, schema } from '../db'

function rowToPolicy(row: typeof schema.policy.$inferSelect): PolicyState {
  let activeProvider = (row.providerActive ?? DEFAULT_POLICY.provider.active) as string
  if (activeProvider === 'openai') activeProvider = 'chatgpt'
  return {
    workspaceRoot: row.workspaceRoot ?? null,
    capabilities: JSON.parse(row.capabilities) as Record<string, boolean>,
    themeMode: row.themeMode as PolicyState['themeMode'],
    language: row.language as PolicyState['language'],
    provider: { active: activeProvider as ProviderId, openaiModel: row.providerOpenaiModel ?? DEFAULT_POLICY.provider.openaiModel },
    taskMemoryEnabled: row.taskMemoryEnabled,
    taskAutoApprove: row.taskAutoApprove
  }
}

export function load(): PolicyState {
  const row = getDb().select().from(schema.policy).limit(1).get()
  if (!row) return DEFAULT_POLICY
  return rowToPolicy(row)
}

export function save(next: PolicyState): void {
  const db = getDb()
  const existing = db.select().from(schema.policy).limit(1).get()
  const values = {
    workspaceRoot: next.workspaceRoot, capabilities: JSON.stringify(next.capabilities),
    themeMode: next.themeMode, language: next.language, providerActive: next.provider.active,
    providerOpenaiModel: next.provider.openaiModel, taskMemoryEnabled: next.taskMemoryEnabled,
    taskAutoApprove: next.taskAutoApprove
  }
  if (existing) {
    db.update(schema.policy).set(values).where(eq(schema.policy.id, existing.id)).run()
  } else {
    db.insert(schema.policy).values(values).run()
  }
}

export function init(): void {
  const existing = getDb().select().from(schema.policy).limit(1).get()
  if (!existing) save(DEFAULT_POLICY)
}
