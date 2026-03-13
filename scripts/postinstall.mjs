import { spawnSync } from 'node:child_process'

// During packaging we create a deployed production app dir via `pnpm deploy app`.
// That deploy will run lifecycle scripts from package.json inside ./app as well.
// Running electron-builder's install-app-deps there is unnecessary and can break
// CI on Windows (native rebuild tooling + interactive termination prompts).

if (process.env.SKYNUL_SKIP_EB_APP_DEPS === '1') {
  process.exit(0)
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const res = spawnSync(pnpmCmd, ['exec', 'electron-builder', 'install-app-deps'], {
  stdio: 'inherit',
  env: process.env
})

process.exit(res.status ?? 1)
