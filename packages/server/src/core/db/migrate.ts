import { getSqlite } from './database'

export function runMigrations(): void {
  const db = getSqlite()

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      parent_task_id TEXT,
      agent_name TEXT,
      agent_role TEXT,
      prompt TEXT NOT NULL,
      attachments TEXT,
      status TEXT NOT NULL DEFAULT 'pending_approval',
      mode TEXT NOT NULL DEFAULT 'browser',
      capabilities TEXT NOT NULL DEFAULT '[]',
      steps TEXT NOT NULL DEFAULT '[]',
      usage TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      max_steps INTEGER NOT NULL,
      timeout_ms INTEGER NOT NULL,
      error TEXT,
      summary TEXT,
      source TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      mode TEXT NOT NULL,
      frequency TEXT NOT NULL,
      cron_expr TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS policy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_root TEXT,
      capabilities TEXT NOT NULL DEFAULT '{}',
      theme_mode TEXT NOT NULL DEFAULT 'dark',
      language TEXT NOT NULL DEFAULT 'en',
      provider_active TEXT NOT NULL DEFAULT 'chatgpt',
      provider_openai_model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
      task_memory_enabled INTEGER NOT NULL DEFAULT 1,
      task_auto_approve INTEGER NOT NULL DEFAULT 0
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules (enabled);
    CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules (next_run_at);
    CREATE INDEX IF NOT EXISTS idx_secrets_key ON secrets (key);
  `)
}
