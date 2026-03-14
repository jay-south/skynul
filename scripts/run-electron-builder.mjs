import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const rootDir = process.cwd()
const stageDir = path.join(rootDir, '.packaged-app')
const require = createRequire(import.meta.url)
const electronBuilderCli = path.join(
  path.dirname(require.resolve('electron-builder/package.json')),
  'cli.js'
)

const env = { ...process.env }
delete env.npm_config_user_agent
delete env.npm_execpath
delete env.PNPM_HOME

const result = spawnSync(
  process.execPath,
  [electronBuilderCli, '--projectDir', stageDir, ...process.argv.slice(2)],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env
  }
)

if (result.error) throw result.error
process.exit(result.status ?? 1)
