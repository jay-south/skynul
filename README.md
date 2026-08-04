<p align="center">
  <picture>
    <source srcset="src/renderer/src/assets/logo-skynul.svg" media="(prefers-color-scheme: dark)" />
    <source srcset="src/renderer/src/assets/logo-skynul-light.svg" media="(prefers-color-scheme: light)" />
    <img src="src/renderer/src/assets/logo-skynul-light.svg" alt="Skynul" width="520" />
  </picture>
</p>

<p align="center">Local-first desktop agent with explicit permissions. Deny by default.</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" /></a>
  <img alt="Status" src="https://img.shields.io/badge/status-alpha-lightgrey?style=flat-square" />
</p>

# Skynul

Skynul is a local-first desktop agent built around a simple premise: deny by default.

You explicitly enable capabilities (network, filesystem, etc.) and the app enforces those gates.

## Architecture

Skynul uses Electron for the UI and a single Rust backend process:

```
┌─────────────────┐    HTTP + WS (/api/v1)    ┌─────────────────────────┐
│   Electron SPA  │  ←────────────────────→  │  skynul-server (Rust)   │
│  React + Query  │                          │  Axum API, agent loop,  │
└─────────────────┘                          │  channels, SQLite       │
                                             └─────────────────────────┘
```

**Frontend** (`src/renderer/`): React SPA with React Router and React Query  
**Backend** (`packages/core/`): Rust server (`skynul-server`) — conversational chat or tool-calling agent harness  
**Shared types** (`src/shared/`): API contract for the frontend

### Shared types (`src/shared/`)

```
src/shared/
├── generated.ts   # Generated from Rust via typeshare (pnpm gen:types)
├── api.ts         # API types, unions, constants (imports generated.ts)
└── index.ts       # Re-exports
```

Regenerate TypeScript types after changing Rust API types in `packages/core/src/api/types.rs`:

```bash
pnpm gen:types
```

### API (`/api/v1/`)

| Area | Endpoints |
|------|-----------|
| Tasks | `GET/POST /tasks`, `GET /tasks/:id`, `POST /tasks/:id/cancel`, `WS /tasks/:id/stream` |
| Projects | `GET/POST /projects`, `PATCH/DELETE /projects/:id`, `POST /projects/:id/tasks` |
| Schedules | `GET/POST /schedules`, `PUT /schedules/:id/toggle`, `DELETE /schedules/:id` |
| Settings | General, model, permissions |
| Providers | `GET /providers`, credentials CRUD |
| Channels | List, pair, configure |

### Frontend Structure

```
src/renderer/src/
├── queries/           # React Query modules (tasks, projects, schedules, etc.)
│   ├── tasks/         # hooks.ts, service.ts, keys.ts, types.ts
│   └── ...
├── pages/             # Route pages
├── layouts/           # Route layouts
├── components/        # React components
└── main.tsx          # Entry point with QueryProvider
```

## Install

Dependencies:

- Node.js
- pnpm

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Starts the Rust backend and Electron app together. The server listens on `http://localhost:3141` (override with `SKYNUL_PORT`).

To run them separately:

```bash
pnpm dev:backend   # Rust API only
pnpm dev:desktop   # Electron only (requires SKYNUL_EXTERNAL_SERVER=1)
```

## Build

```bash
# Build for production
pnpm build
```

## Quality Checks

```bash
pnpm lint
pnpm typecheck
```

## Environment Variables

Environment variables can be provided via your shell or a repo-root `.env` file (see `.env.example`).

Key variables:

- `SKYNUL_PORT` - Server port (default: 3141)
- `SKYNUL_DATA_DIR` - Data directory override (default: ~/.skynul)

## Security And Permission Model

Skynul has two separate concepts:

- **App policy capabilities** (enforced): `cmd.run`, `fs.read`, `fs.write`, `net.http` gate tool execution and network access.

Details: `docs/permissions.md`

If you are reporting a vulnerability, follow: `SECURITY.md`

## Providers

Provider choice is stored in the local policy state. Some providers use API keys stored in the local secret store; ChatGPT uses an OAuth flow.

Details: `docs/providers.md`

## Configuration

What is configurable, which env vars exist, and where settings are stored:

Details: `docs/configuration.md`

## Development

Repo layout and development commands:

- `docs/development.md`
- `CONTRIBUTING.md`

## Legal

- License: `LICENSE`
- Notices: `NOTICE`
- Trademarks: `TRADEMARK.md`
