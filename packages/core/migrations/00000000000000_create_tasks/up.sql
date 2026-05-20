CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    prompt TEXT NOT NULL,
    attachments TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
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
