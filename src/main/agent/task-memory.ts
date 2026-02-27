/**
 * TaskMemory — SQLite + FTS5 persistent memory for the computer-use agent.
 *
 * After each task, the vision model extracts learnings.
 * Before each new task, relevant memories are retrieved and injected as context.
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db
  const dbPath = join(app.getPath('userData'), 'memory.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      outcome TEXT NOT NULL,
      learnings TEXT NOT NULL,
      provider TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS task_memories_fts USING fts5(
      prompt, learnings, content=task_memories, content_rowid=id
    );
    CREATE TRIGGER IF NOT EXISTS task_memories_ai AFTER INSERT ON task_memories BEGIN
      INSERT INTO task_memories_fts(rowid, prompt, learnings)
      VALUES (new.id, new.prompt, new.learnings);
    END;
    CREATE TRIGGER IF NOT EXISTS task_memories_ad AFTER DELETE ON task_memories BEGIN
      INSERT INTO task_memories_fts(task_memories_fts, rowid, prompt, learnings)
      VALUES ('delete', old.id, old.prompt, old.learnings);
    END;
  `)
  return db
}

export type TaskMemory = {
  prompt: string
  outcome: 'completed' | 'failed'
  learnings: string
}

export function saveMemory(entry: {
  taskId: string
  prompt: string
  outcome: 'completed' | 'failed'
  learnings: string
  provider?: string
  durationMs?: number
}): void {
  try {
    getDb().prepare(`
      INSERT OR REPLACE INTO task_memories (task_id, prompt, outcome, learnings, provider, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.taskId,
      entry.prompt,
      entry.outcome,
      entry.learnings,
      entry.provider ?? null,
      entry.durationMs ?? null,
      Date.now()
    )
  } catch {
    // Non-critical
  }
}

export function searchMemories(query: string, limit = 3): TaskMemory[] {
  try {
    const rows = getDb().prepare(`
      SELECT t.prompt, t.outcome, t.learnings
      FROM task_memories_fts f
      JOIN task_memories t ON t.id = f.rowid
      WHERE task_memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(sanitizeFtsQuery(query), limit) as TaskMemory[]
    return rows
  } catch {
    return []
  }
}

export function formatMemoriesForPrompt(memories: TaskMemory[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m, i) => {
    const status = m.outcome === 'completed' ? 'SUCCESS' : 'FAILED'
    return `[Memory ${i + 1}] (${status}) Task: "${m.prompt}"\nLearnings: ${m.learnings}`
  })
  return `\n## Relevant past experience:\n${lines.join('\n\n')}\n`
}

export function closeMemoryDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function sanitizeFtsQuery(query: string): string {
  // Split into words and join with OR for fuzzy matching
  const words = query
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  if (words.length === 0) return '""'
  return words.map((w) => `"${w}"`).join(' OR ')
}
