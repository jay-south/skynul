import { type ChildProcess, execSync, spawn } from 'node:child_process'
import os from 'node:os'
import { resolve } from 'node:path'

let serverProcess: ChildProcess | null = null

function killPort(port: number): void {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'ignore' })
  } catch {
    /* port was free or fuser not available */
  }
}

/**
 * Spawn the Rust server binary.
 * In dev mode: uses cargo run from the packages/core directory.
 * In production: uses the pre-built binary.
 */
export async function spawnServer(_authToken: string): Promise<void> {
  const port = parseInt(process.env.SKYNUL_PORT ?? '3141', 10)
  killPort(port)

  const isDev = process.env.NODE_ENV !== 'production'

  let cmd: string
  let args: string[]
  let cwd: string

  if (isDev) {
    // Dev: use cargo run for hot reload during development
    cmd = 'cargo'
    args = ['run', '--bin', 'skynul-server', '--quiet']
    cwd = resolve(__dirname, '../../packages/core')
  } else {
    // Production: run the compiled binary directly
    const binaryName = process.platform === 'win32' ? 'skynul-server.exe' : 'skynul-server'
    cmd = resolve(__dirname, '../packages/core', binaryName)
    args = []
    cwd = resolve(__dirname, '../packages/core')
  }

  serverProcess = spawn(cmd, args, {
    env: {
      ...process.env,
      SKYNUL_PORT: String(port),
      SKYNUL_HOME: process.env.SKYNUL_HOME ?? os.homedir(),
      NODE_ENV: isDev ? 'development' : 'production'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd
  })

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`)
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[server] ${data.toString().trim()}`)
  })

  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`)
  })

  serverProcess.on('error', (err) => {
    console.error(`[server] failed to start: ${err.message}`)
  })

  // Wait for server to be ready
  await waitForServer(30, 500, port)
}

/** Poll the server health endpoint until it responds. */
async function waitForServer(maxAttempts = 30, intervalMs = 500, port = 3141): Promise<void> {
  const url = `http://localhost:${port}/ping`

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`Server did not become ready after ${maxAttempts * intervalMs}ms`)
}

/** Gracefully shut down the server process. */
export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}
