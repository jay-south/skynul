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

Skynul uses a **separated architecture** with a clear frontend/backend split:

```
┌─────────────────┐      HTTP/WebSocket      ┌─────────────────┐
│   Electron SPA  │  ←──────────────────→   │  Skynul Server  │
│  ┌───────────┐  │                         │  (API REST)     │
│  │  React    │  │                         │                 │
│  │  Router   │  │                         │  ┌───────────┐  │
│  │  React    │  │                         │  │  Tasks    │  │
│  │  Query    │  │                         │  │  Policy   │  │
│  └───────────┘  │                         │  │  etc.     │  │
└─────────────────┘                         │  └───────────┘  │
                                            └─────────────────┘
```

**Frontend** (`src/renderer/`): React SPA with React Router 7 and React Query
**Backend** (`packages/server/`): Hono.js HTTP API with WebSocket support
**Shared** (`packages/shared/`): TypeScript types shared between frontend and backend

### Frontend Structure

```
src/renderer/src/
├── queries/           # React Query modules (tasks, policy, etc.)
│   ├── tasks/         # Task queries: hooks.ts, service.ts, keys.ts, types.ts
│   ├── policy/        # Policy queries
│   └── ...
├── pages/             # Route pages
├── layouts/           # Route layouts
├── components/        # React components
└── main.tsx          # Entry point with QueryProvider
```

Each query module follows the pattern:

- `types.ts` - TypeScript interfaces
- `keys.ts` - React Query keys
- `service.ts` - HTTP API functions
- `hooks.ts` - React Query hooks (useQuery, useMutation)

## Install

Dependencies:

- Node.js
- pnpm

```bash
pnpm install
```

## Development

You need to run **both** the server and the Electron app:

```bash
# Terminal 1: Start the backend server
pnpm server:dev

# Terminal 2: Start the Electron app
pnpm dev
```

The server runs on `http://localhost:3141` and the Electron app connects to it via HTTP.

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

- `VITE_SUPABASE_URL` - Supabase URL for OAuth
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `SKYNUL_PORT` - Server port (default: 3141)

## Security And Permission Model

Skynul has two separate concepts:

- **App policy capabilities** (enforced): `net.http`, `fs.read`, `fs.write` are checked before network calls or workspace file access.
- **Task capabilities** (task-scoped): flags like `polymarket.trading` or `office.professional` shape how a task runs.

Details: `docs/permissions.md`

If you are reporting a vulnerability, follow: `SECURITY.md`

## Browser Automation (Playwright + CDP)

Skynul connects to a locally launched Chromium-based browser over CDP.

Details: `docs/browser-cdp.md`

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
