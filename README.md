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

You explicitly enable capabilities (network, filesystem, etc.) and the app enforces those gates in the main process.

## Install

Dependencies:

- Node.js
- pnpm

```bash
pnpm install
```

## Quickstart

Run the desktop app in dev mode:

```bash
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
```

Environment variables can be provided via your shell or a repo-root `.env` file (see `.env.example`).

## Security And Permission Model

Skynul has two separate concepts that people tend to mix up:

- App policy capabilities (enforced): `net.http`, `fs.read`, `fs.write` are checked in IPC handlers before network calls or workspace file access.
- Task capabilities (task-scoped): flags like `polymarket.trading` or `office.professional` shape how a task runs and what it is instructed to do.

Details:

- `docs/permissions.md`

If you are reporting a vulnerability, follow:

- `SECURITY.md`

## Browser Automation (Playwright + CDP)

Skynul connects to a locally launched Chromium-based browser over CDP (it auto-detects common installs; you can override with env vars).

- `docs/browser-cdp.md`

## Providers

Provider choice is stored in the local policy state. Some providers use API keys stored in the local secret store; ChatGPT uses an OAuth flow; some vision flows route via Supabase Edge Functions.

- `docs/providers.md`

## Configuration

What is configurable, which env vars exist, and where settings are stored:

- `docs/configuration.md`

## Development

Repo layout and development commands:

- `docs/development.md`
- `CONTRIBUTING.md`

## Legal

- License: `LICENSE`
- Notices: `NOTICE`
- Trademarks: `TRADEMARK.md`
