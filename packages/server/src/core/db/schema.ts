import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

// ── Projects ──────────────────────────────────────────────────────────────────

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  createdAt: integer('created_at').notNull()
})

// ── Project ↔ Task relationship ───────────────────────────────────────────────

export const projectTasks = sqliteTable(
  'project_tasks',
  {
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    addedAt: integer('added_at').notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.taskId] })
  })
)

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  parentTaskId: text('parent_task_id'),
  agentName: text('agent_name'),
  agentRole: text('agent_role'),
  prompt: text('prompt').notNull(),
  attachments: text('attachments'), // JSON string[]
  status: text('status').notNull().default('pending_approval'),
  mode: text('mode').notNull().default('browser'),
  capabilities: text('capabilities').notNull(), // JSON TaskCapabilityId[]
  steps: text('steps').notNull().default('[]'), // JSON TaskStep[]
  usage: text('usage'), // JSON { inputTokens, outputTokens }
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  maxSteps: integer('max_steps').notNull(),
  timeoutMs: integer('timeout_ms').notNull(),
  error: text('error'),
  summary: text('summary'),
  source: text('source')
})

// ── Schedules ─────────────────────────────────────────────────────────────────

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  capabilities: text('capabilities').notNull(), // JSON TaskCapabilityId[]
  mode: text('mode').notNull(),
  frequency: text('frequency').notNull(),
  cronExpr: text('cron_expr').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: integer('last_run_at'),
  nextRunAt: integer('next_run_at').notNull(),
  createdAt: integer('created_at').notNull()
})

// ── Skills ────────────────────────────────────────────────────────────────────

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tag: text('tag').notNull(),
  description: text('description').notNull(),
  prompt: text('prompt').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull()
})

// ── Secrets ───────────────────────────────────────────────────────────────────

export const secrets = sqliteTable('secrets', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull()
})

// ── Policy (single-row config) ────────────────────────────────────────────────

export const policy = sqliteTable('policy', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceRoot: text('workspace_root'),
  capabilities: text('capabilities').notNull(), // JSON Record<CapabilityId, boolean>
  themeMode: text('theme_mode').notNull().default('dark'),
  language: text('language').notNull().default('en'),
  providerActive: text('provider_active').notNull().default('chatgpt'),
  providerOpenaiModel: text('provider_openai_model').notNull().default('gpt-4.1-mini'),
  taskMemoryEnabled: integer('task_memory_enabled', { mode: 'boolean' }).notNull().default(true),
  taskAutoApprove: integer('task_auto_approve', { mode: 'boolean' }).notNull().default(false)
})
