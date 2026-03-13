import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

const env = {
  ...process.env,
  EB_USE_APP_DIR: '1'
}

// On Windows runners, spawning `pnpm.cmd` directly can be brittle depending on PATH shims.
// Using `shell: true` matches how we invoke pnpm in other scripts.
const res = spawnSync(
  'pnpm',
  ['exec', 'electron-builder', '--config', 'electron-builder.config.cjs', ...args],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env
  }
)

if (res.error) {
  console.error('[run-electron-builder] spawn error:', res.error)
}

process.exit(res.status ?? 1)
