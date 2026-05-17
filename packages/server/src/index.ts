import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { runMigrations } from './core/db/migrate'
import { closeDb } from './core/db/database'
import { authMiddleware } from './middleware/auth'
import { corsMiddleware } from './middleware/cors'
import { browser } from './routes/browser'
import { channelManager, channels } from './routes/channels'
import { chat } from './routes/chat'
import { chatgpt } from './routes/chatgpt'
import { dialogs } from './routes/dialogs'
import { ollama } from './routes/ollama'
import { policy } from './routes/policy'
import { projects } from './routes/projects'
import { runtime } from './routes/runtime'
import { schedules } from './routes/schedules'
import { secrets } from './routes/secrets'
import { skills } from './routes/skills'
import { taskManager, tasks } from './routes/tasks'
import { closeSharedPlaywrightChromeCdp } from './core/browser/playwright-cdp'
import { addClient, clientCount, removeClient } from './ws/events'

// ── Routes ──────────────────────────────────────────────────────────────

function setupRoutes(app: Hono): Hono {
  return app
    .route('/api/tasks', tasks)
    .route('/api/policy', policy)
    .route('/api/channels', channels)
    .route('/api/skills', skills)
    .route('/api/schedules', schedules)
    .route('/api/chat', chat)
    .route('/api/projects', projects)
    .route('/api/secrets', secrets)
    .route('/api/browser', browser)
    .route('/api/ollama', ollama)
    .route('/api/chatgpt', chatgpt)
    .route('/api/runtime', runtime)
    .route('/api/dialogs', dialogs)
}

// ── WebSocket ───────────────────────────────────────────────────────────

function setupWebSocket(app: Hono): ReturnType<typeof createNodeWebSocket> {
  const ws = createNodeWebSocket({ app })
  app.get('/ws', ws.upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      addClient(ws)
      ws.send(JSON.stringify({ type: 'connected', payload: { ts: Date.now() } }))
    },
    onClose(_event, ws) { removeClient(ws) },
    onError(_event, ws) { removeClient(ws) }
  })))
  return ws
}

// ── Lifecycle ───────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log('\nShutting down...')
  await channelManager.stopAll()
  taskManager().destroyAll()
  await closeSharedPlaywrightChromeCdp()
  closeDb()
}

process.on('SIGINT', () => void shutdown().then(() => process.exit(0)))
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)))

// ── Start ───────────────────────────────────────────────────────────────

const app = new Hono()
  .use(logger())
  .use(corsMiddleware)
  .use(authMiddleware)
  .get('/ping', (c) => c.json({ status: 'ok', ts: Date.now(), wsClients: clientCount() }))

const routes = setupRoutes(app)
const ws = setupWebSocket(app)

export type AppType = typeof routes

runMigrations()

const port = parseInt(process.env.SKYNUL_PORT ?? '3141', 10)

const server = serve({ fetch: routes.fetch, port }, (info) => {
  console.log(`skynul-server listening on http://localhost:${info.port}`)
})

ws.injectWebSocket(server)
