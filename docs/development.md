# Development

## Commands

Install dependencies:

```bash
pnpm install
```

Run the app (dev):

```bash
pnpm dev
```

Preview (after a build):

```bash
pnpm start
```

Quality:

```bash
pnpm lint
pnpm typecheck
pnpm format
```

Packaging:

```bash
pnpm build
pnpm build:unpack
pnpm build:win
pnpm build:mac
pnpm build:linux
```

## Repo Layout

- `src/main/` - Electron main process (IPC, policy, providers, task runner, channels).
- `src/preload/` - preload bridge exposed to the renderer.
- `src/renderer/` - renderer UI.
- `src/shared/` - shared types (policy, tasks, IPC).
- `supabase/functions/` - Supabase Edge Functions used by some providers.

## Persisted State

Local settings and data are stored under Electron `app.getPath('userData')`.

- See `docs/configuration.md` for the file list.

## Contributing

- `CONTRIBUTING.md`
