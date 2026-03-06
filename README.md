# Skynul

Local-first desktop agent with explicit permissions.

Core idea: deny by default. The model only gets the tools and scopes you enable.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

## Environment

Create a `.env` file in the project root (see `.env.example`).

### Browser / CDP (Playwright)

Some tasks need a real Chromium-based browser reachable via Chrome DevTools Protocol (CDP).

- If your system has Chrome/Chromium installed in a standard location, Skynul auto-detects it.
- If auto-detection fails (common when running the Electron app from a desktop launcher), set `SKYNUL_CHROME_PATH` to an absolute executable path.

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
