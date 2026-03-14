import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const rootDir = process.cwd()
const stageDir = path.join(rootDir, '.packaged-app')
const outDir = path.join(rootDir, 'out')
const buildResourcesDir = path.join(rootDir, 'build')
const builderConfigPath = path.join(rootDir, 'electron-builder.yml')
const rootPkgPath = path.join(rootDir, 'package.json')
const stagePkgPath = path.join(stageDir, 'package.json')
const stageBuilderConfigPath = path.join(stageDir, 'electron-builder.yml')
const require = createRequire(import.meta.url)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Command failed (${command} ${args.join(' ')})`)
  }
}

function cleanPackageManagerEnv() {
  const env = { ...process.env }
  delete env.npm_config_user_agent
  delete env.npm_execpath
  delete env.PNPM_HOME
  return env
}

if (!existsSync(outDir)) {
  throw new Error('Missing build output in ./out. Run `pnpm build` before packaging.')
}

rmSync(stageDir, { recursive: true, force: true })
mkdirSync(stageDir, { recursive: true })

run('pnpm', ['--filter', '.', '--prod', 'deploy', '--legacy', '--ignore-scripts', stageDir])

const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
const stagePkg = JSON.parse(readFileSync(stagePkgPath, 'utf8'))

stagePkg.name = rootPkg.name
stagePkg.version = rootPkg.version
stagePkg.description = rootPkg.description
stagePkg.license = rootPkg.license
stagePkg.author = rootPkg.author
stagePkg.repository = rootPkg.repository
stagePkg.homepage = rootPkg.homepage
stagePkg.main = rootPkg.main
stagePkg.dependencies = rootPkg.dependencies
delete stagePkg.devDependencies
delete stagePkg.packageManager
delete stagePkg.pnpm
delete stagePkg.scripts

writeFileSync(stagePkgPath, JSON.stringify(stagePkg, null, 2) + '\n')

for (const fileName of ['pnpm-lock.yaml', '.npmrc']) {
  const filePath = path.join(stageDir, fileName)
  if (existsSync(filePath)) unlinkSync(filePath)
}

if (existsSync(buildResourcesDir)) {
  cpSync(buildResourcesDir, path.join(stageDir, 'build'), { recursive: true })
}

cpSync(outDir, path.join(stageDir, 'out'), { recursive: true })

const builderConfig = readFileSync(builderConfigPath, 'utf8')
  .replace(/^  app: \.$/m, '  # app dir defaults to the staged project root')
  .replace(/^  output: dist$/m, '  output: ../dist')
writeFileSync(stageBuilderConfigPath, builderConfig)

const electronBuilderCli = path.join(
  path.dirname(require.resolve('electron-builder/package.json')),
  'cli.js'
)
run(
  process.execPath,
  [electronBuilderCli, 'install-app-deps', '--platform', process.platform, '--arch', process.arch],
  { cwd: stageDir, env: cleanPackageManagerEnv() }
)
