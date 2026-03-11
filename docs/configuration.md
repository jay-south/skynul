# Configuration

This doc only lists configuration that exists in the repo today (env vars, persisted files, and known settings).

## Environment Variables

Browser (Playwright + CDP):

- `SKYNUL_CHROME_PATH` - absolute path or command name to resolve Chrome/Chromium.
- `SKYNUL_CHROME_USER_DATA_DIR` - override Chrome user data dir (absolute or relative to Electron userData).
- `SKYNUL_CHROME_PROFILE_DIRECTORY` - Chrome profile directory name (defaults to `Default`).
- `SKYNUL_CHROME_CDP_TIMEOUT_MS` - CDP startup timeout (clamped to 1s..180s).
- `SKYNUL_CHROME_NO_SANDBOX` - set to `1` to add `--no-sandbox` flags.

Supabase (renderer and some main-process vision providers):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Provider tuning:

- `GEMINI_BASE_URL`, `GEMINI_MODEL`, `GEMINI_VISION_MODEL`
- `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `MINIMAX_VISION_MODEL`, `MINIMAX_GROUP_ID`

Polymarket:

- `POLYMARKET_PRIVATE_KEY`
- `POLYMARKET_FUNDER_ADDRESS`
- `POLYMARKET_SIGNATURE_TYPE`
- `POLYMARKET_CLOB_URL`
- `POLYMARKET_CHAIN_ID`

Runtime:

- `TZ` - used to propagate timezone to Chromium (also auto-detected on WSL in some cases).
- `ELECTRON_RENDERER_URL` - used by electron-vite in dev.

Notes:

- For local development you can use a repo-root `.env` file (see `.env.example`).
- Anything under `VITE_*` is intended for the renderer; treat it as public (it gets bundled).

## Where Settings Are Stored

Skynul persists state under Electron `app.getPath('userData')`.

Policy and toggles:

- `policy.json` - workspaceRoot, app capabilities, provider selection, UI preferences.

Secrets:

- `secrets.json` - stored via Electron `safeStorage` when available, with a plain base64 fallback.

Tasks and memory:

- `tasks.json` - task metadata persisted without full screenshot payloads.
- `memory.db` - SQLite database for task memory (FTS5).

Other persisted state:

- `skills.json`
- `schedules.json`
- `browser-snapshots.json`
- `channels/` (per-channel JSON files)
- `browser/` (Chrome profile selection marker and Skynul-managed user data dir)
- `artifacts/` (task artifacts output)
