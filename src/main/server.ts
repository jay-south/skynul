import { spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'

let serverProcess: ChildProcess | null = null

/**
 * Spawn the Hono server process with the auth token.
 * In dev mode: uses tsx to run the TypeScript source.
 * In production: uses the compiled JS output.
 */
export async function spawnServer(authToken: string): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production'

  const serverRoot = resolve(__dirname, isDev ? '../../packages/server' : '../packages/server')
  const serverScript = isDev ? 'src/index.ts' : 'src/index.js'

  let cmd: string
  let args: string[]

  if (isDev) {
    // Dev: use tsx to run TypeScript directly
    const tsxBin = require.resolve('tsx')
    cmd = process.execPath
    args = [tsxBin, resolve(serverRoot, serverScript)]
  } else {
    // Production: run compiled JS with Node
    cmd = process.execPath
    args = [resolve(serverRoot, serverScript)]
  }

  serverProcess = spawn(cmd, args, {
    env: {
      ...process.env,
      SKYNUL_AUTH_TOKEN: authToken,
      NODE_ENV: isDev ? 'development' : 'production'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: serverRoot
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
  await waitForServer()
}

/** Poll the server health endpoint until it responds. */
async function waitForServer(maxAttempts = 30, intervalMs = 500): Promise<void> {
  const port = process.env.SKYNUL_PORT ?? '3141'
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
