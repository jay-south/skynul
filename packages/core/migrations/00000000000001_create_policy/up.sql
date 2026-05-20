CREATE TABLE IF NOT EXISTS policy (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    workspace_root TEXT,
    capabilities TEXT NOT NULL DEFAULT '{}',
    theme_mode TEXT NOT NULL DEFAULT 'dark',
    language TEXT NOT NULL DEFAULT 'en',
    provider_active TEXT NOT NULL DEFAULT 'chatgpt',
    provider_model TEXT,
    task_auto_approve INTEGER NOT NULL DEFAULT 0,
    CHECK (id = 1)
);

INSERT OR IGNORE INTO policy (id) VALUES (1);
