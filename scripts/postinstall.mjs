import { spawnSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// During packaging we create a deployed production app dir via `pnpm deploy app`.
// That deploy will run lifecycle scripts from package.json inside ./app as well.
// Running electron-builder's install-app-deps there is unnecessary and can break
// CI on Windows (native rebuild tooling + interactive termination prompts).

if (process.env.SKYNUL_SKIP_EB_APP_DEPS === '1') {
  process.exit(0)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

// electron-builder prefers a two-package structure if it sees an ./app directory.
// Our packaging flow creates ./app as a deploy artifact, so we temporarily hide it
// to ensure install-app-deps runs against the root project.
const appDir = path.join(repoRoot, 'app')
let hiddenAppDir = null

if (existsSync(appDir)) {
  hiddenAppDir = `${appDir}.__hidden_postinstall__${Date.now()}`
  try {
    renameSync(appDir, hiddenAppDir)
  } catch (err) {
    hiddenAppDir = null
    // If we cannot move it (e.g. Windows file locks), continue anyway.
    // Worst case: electron-builder will pick ./app and fail, surfacing the error.
    console.warn('[postinstall] Could not hide ./app dir:', err)
  }
}

let exitCode = 1
try {
  const require = createRequire(import.meta.url)
  const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js')

  const res = spawnSync(process.execPath, [electronBuilderCli, 'install-app-deps'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  })

  exitCode = res.status ?? 1
} finally {
  if (hiddenAppDir) {
    try {
      renameSync(hiddenAppDir, appDir)
    } catch (err) {
      console.warn('[postinstall] Could not restore ./app dir:', err)
    }
  }
}

process.exit(exitCode)
