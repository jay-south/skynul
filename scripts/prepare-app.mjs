import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const repoRoot = resolve(__dirname, '..')
const appDir = resolve(repoRoot, 'app')
const outDir = resolve(repoRoot, 'out')
const resourcesDir = resolve(repoRoot, 'resources')

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts
  })

  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

if (existsSync(appDir)) {
  rmSync(appDir, { recursive: true, force: true })
}

console.log('[prepare-app] deploying production app dir to', appDir)

// Create a production-only app directory with a complete node_modules tree.
// This avoids packaging-time missing-module issues with pnpm + electron-builder.
// pnpm v10 tightened deploy semantics for workspaces.
// We use --legacy to produce a deployable production directory without requiring
// inject-workspace-packages=true.
run('pnpm', ['--filter', 'skynul', '--prod', '--legacy', 'deploy', 'app'], {
  env: {
    ...process.env,
    // Avoid running electron-builder install-app-deps inside the deployed app dir.
    // That step is meant for local development installs, not for deploy packaging.
    SKYNUL_SKIP_EB_APP_DEPS: '1'
  }
})

console.log('[prepare-app] copying build output into deployed app dir')

// Copy build output and runtime resources into the deployed app.
if (!existsSync(outDir)) {
  throw new Error('Missing out/. Run `pnpm build` first.')
}
cpSync(outDir, resolve(appDir, 'out'), { recursive: true })

if (existsSync(resourcesDir)) {
  mkdirSync(resolve(appDir, 'resources'), { recursive: true })
  cpSync(resourcesDir, resolve(appDir, 'resources'), { recursive: true })
}

console.log('[prepare-app] done')
