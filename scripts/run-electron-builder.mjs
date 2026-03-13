import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

const res = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'electron-builder', '--config', 'electron-builder.config.cjs', ...args],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      EB_USE_APP_DIR: '1'
    }
  }
)

process.exit(res.status ?? 1)
