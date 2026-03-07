# Permissions and Capabilities

Skynul is an Electron desktop app. There are two distinct layers of permissions:

1. App policy capabilities (enforced)
2. Task capabilities (task-scoped)

This doc lists what exists in the repo today and what is actually enforced.

## App Policy Capabilities (enforced)

Stored in the policy state as booleans:

- `net.http`
- `fs.read`
- `fs.write`
- `cmd.run` (present in the policy model; not currently enforced in IPC handlers)

Enforcement points:

- Network chat requires `net.http`.
- Workspace file reads require `fs.read`.
- Workspace file writes require `fs.write`.

Workspace boundary:

- The user picks a `workspaceRoot` directory.
- File APIs require relative paths only and reject paths that would escape the workspace.

## Task Capabilities (task-scoped)

Tasks carry a list of task capability IDs:

- `browser.cdp`
- `app.launch`
- `polymarket.trading`
- `office.professional`

Current behavior:

- `polymarket.trading` switches tasks into an API-only runner path (no browser automation).
- Other task capabilities are primarily used to shape prompts/defaults; they are not a substitute for app policy enforcement.

## Electron and Web Permissions

Main windows run with hardened Electron webPreferences:

- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `webSecurity: true`

Permission requests are handled centrally:

- Allowed: `media`, `mediaKeySystem`
- Denied: everything else

External navigation:

- New windows are denied; http(s) links are opened via the OS browser.

## Related

- Vulnerability reporting: `SECURITY.md`
