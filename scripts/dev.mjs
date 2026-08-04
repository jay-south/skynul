import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreDir = resolve(rootDir, 'packages/core')
const port = Number.parseInt(process.env.SKYNUL_PORT ?? '3141', 10)
const children = []
let shuttingDown = false

function loadEnvFile() {
  const envPath = resolve(rootDir, '.env')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function killExistingBackend(targetPort) {
  if (process.platform !== 'linux') return

  try {
    execSync('pkill -x skynul-server 2>/dev/null || true', { stdio: 'ignore' })
  } catch {}

  try {
    execSync(`fuser -k ${targetPort}/tcp 2>/dev/null`, { stdio: 'ignore' })
  } catch {}

  try {
    execSync('sleep 0.3')
  } catch {}
}

function prefixStream(stream, label, color) {
  const reset = '\x1b[0m'
  stream.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.length > 0) {
        process.stdout.write(`${color}[${label}]${reset} ${line}\n`)
      }
    }
  })
}

function spawnProcess(label, command, args, options = {}) {
  const colors = {
    backend: '\x1b[36m',
    desktop: '\x1b[35m'
  }

  const child = spawn(command, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  })

  prefixStream(child.stdout, label, colors[label] ?? '')
  prefixStream(child.stderr, label, colors[label] ?? '')

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    const reason = signal ?? code
    console.error(`[dev] ${label} terminó (${reason})`)
    shutdown(typeof code === 'number' ? code : 1)
  })

  children.push(child)
  return child
}

async function waitForBackend() {
  const url = `http://localhost:${port}/ping`
  const maxAttempts = 360

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}

    if (attempt > 0 && attempt % 20 === 0) {
      console.log(`[dev] esperando backend… (${attempt / 2}s, compilando Rust si es la primera vez)`)
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }

  throw new Error(`El backend no respondió en ${url} tras ${maxAttempts / 2}s`)
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    child.kill('SIGTERM')
  }

  setTimeout(() => process.exit(exitCode), 500)
}

loadEnvFile()
killExistingBackend(port)

const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
const localBin = resolve(rootDir, 'node_modules/.bin')
const mergedPath = process.env[pathKey] ? `${localBin}${process.platform === 'win32' ? ';' : ':'}${process.env[pathKey]}` : localBin

const sharedEnv = {
  ...process.env,
  [pathKey]: mergedPath,
  SKYNUL_PORT: String(port),
  SKYNUL_HOME: process.env.SKYNUL_HOME ?? process.env.HOME ?? os.homedir()
}

console.log(`[dev] iniciando backend en http://localhost:${port}`)

spawnProcess('backend', 'cargo', ['run', '--bin', 'skynul-server'], {
  cwd: coreDir,
  env: sharedEnv
})

try {
  await waitForBackend()
} catch (error) {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`)
  shutdown(1)
  process.exit(1)
}

console.log('[dev] backend listo, iniciando desktop')

spawnProcess('desktop', 'pnpm', ['exec', 'electron-vite', 'dev'], {
  env: {
    ...sharedEnv,
    SKYNUL_EXTERNAL_SERVER: '1'
  }
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
