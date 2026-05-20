CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY NOT NULL,
    prompt TEXT NOT NULL,
    capabilities TEXT NOT NULL DEFAULT '[]',
    mode TEXT NOT NULL DEFAULT 'browser',
    frequency TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at INTEGER,
    next_run_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
