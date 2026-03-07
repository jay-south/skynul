# Browser (Playwright + CDP)

Skynul launches a local Chromium-based browser with a remote debugging port and then connects via Playwright's `connectOverCDP`.

## Requirements

- A Chromium-based browser installed locally (Chrome, Chromium, Edge, Brave, Vivaldi).

Skynul attempts to auto-detect common install paths. If detection fails, set `SKYNUL_CHROME_PATH`.

## Common Configuration

- Force a specific browser executable:
  - `SKYNUL_CHROME_PATH=/absolute/path/to/chrome`
  - `SKYNUL_CHROME_PATH=google-chrome-stable` (resolved via PATH)

- Use a specific Chrome profile directory (defaults to `Default`):
  - `SKYNUL_CHROME_PROFILE_DIRECTORY=Default`

- Override the user data dir:
  - `SKYNUL_CHROME_USER_DATA_DIR=/absolute/path/to/user-data`
  - If you provide a relative value, Skynul stores it under Electron userData.

- Increase CDP startup timeout:
  - `SKYNUL_CHROME_CDP_TIMEOUT_MS=45000`

- Disable the sandbox flags:
  - `SKYNUL_CHROME_NO_SANDBOX=1`

## Profile Handling

- Default: Skynul uses a userData directory under Electron userData and may import session data from an existing local profile as best-effort.
- If the default profile dir is locked, Skynul retries with deterministic fallback dirs.
- If you explicitly set `SKYNUL_CHROME_USER_DATA_DIR`, Skynul fails fast on profile lock rather than silently falling back.

## Troubleshooting

WSL:

- If WSL is detected and `SKYNUL_CHROME_PATH` resolves to a Windows `chrome.exe`, Skynul errors.
- Fix: install a Linux Chromium inside WSL and point `SKYNUL_CHROME_PATH` to it (example: `/usr/bin/chromium`).

Ubuntu snap Chromium timeouts:

- Snap-wrapped Chromium often fails to come up with a usable CDP endpoint.
- Fix: install Google Chrome (.deb) and set `SKYNUL_CHROME_PATH=/usr/bin/google-chrome-stable`.

Profile in use:

- Close other Chrome instances using the same profile, or unset `SKYNUL_CHROME_USER_DATA_DIR` to let Skynul manage its own profile directory.
