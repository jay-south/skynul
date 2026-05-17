import { zValidator } from '@hono/zod-validator'
import type { ProviderId, PolicyState } from '@skynul/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import * as repo from '../core/repositories/policy'

let initialized = false
let cached: PolicyState | null = null

function load(): PolicyState {
  if (!initialized) { repo.init(); initialized = true }
  if (!cached) cached = repo.load()
  return cached
}

function save(next: PolicyState): void {
  cached = next
  repo.save(next)
}

export function getPolicy(): PolicyState {
  return load()
}

const VALID_PROVIDERS: ProviderId[] = ['chatgpt', 'claude', 'deepseek', 'kimi', 'glm', 'minimax', 'openrouter', 'gemini', 'ollama']

const policyRoutes = new Hono()
  .get('/', (c) => c.json(load()))
  .put('/capability', zValidator('json', z.object({ id: z.enum(['fs.read', 'fs.write', 'cmd.run', 'net.http']), enabled: z.boolean() })), (c) => {
    const { id, enabled } = c.req.valid('json')
    const next = { ...load(), capabilities: { ...load().capabilities, [id]: enabled } }
    save(next); return c.json(next)
  })
  .put('/theme', zValidator('json', z.object({ themeMode: z.enum(['system', 'light', 'dark']) })), (c) => {
    const { themeMode } = c.req.valid('json')
    const next = { ...load(), themeMode }; save(next); return c.json(next)
  })
  .put('/language', zValidator('json', z.object({ language: z.enum(['en', 'es']) })), (c) => {
    const { language } = c.req.valid('json')
    const next = { ...load(), language }; save(next); return c.json(next)
  })
  .put('/provider', zValidator('json', z.object({ active: z.string() })), (c) => {
    const { active } = c.req.valid('json')
    if (!VALID_PROVIDERS.includes(active as ProviderId)) return c.json({ error: `Unknown provider: ${active}` }, 400)
    const next = { ...load(), provider: { ...load().provider, active: active as ProviderId } }
    save(next); return c.json(next)
  })
  .put('/provider/model', zValidator('json', z.object({ model: z.string().min(1) })), (c) => {
    const { model } = c.req.valid('json')
    const next = { ...load(), provider: { ...load().provider, openaiModel: model } }
    save(next); return c.json(next)
  })
  .put('/task-memory', zValidator('json', z.object({ enabled: z.boolean() })), (c) => {
    const { enabled } = c.req.valid('json')
    const next = { ...load(), taskMemoryEnabled: enabled }; save(next); return c.json(next)
  })
  .put('/task-auto-approve', zValidator('json', z.object({ enabled: z.boolean() })), (c) => {
    const { enabled } = c.req.valid('json')
    const next = { ...load(), taskAutoApprove: enabled }; save(next); return c.json(next)
  })
  .put('/workspace', zValidator('json', z.object({ path: z.string().nullable() })), (c) => {
    const { path } = c.req.valid('json')
    const next = { ...load(), workspaceRoot: path }; save(next); return c.json(next)
  })

export { policyRoutes as policy }
export type PolicyRoute = typeof policyRoutes
