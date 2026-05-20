CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'disconnected',
    paired INTEGER NOT NULL DEFAULT 0,
    pairing_code TEXT,
    error TEXT,
    has_credentials INTEGER NOT NULL DEFAULT 0,
    meta TEXT NOT NULL DEFAULT '{}',
    auto_approve INTEGER NOT NULL DEFAULT 0
);
