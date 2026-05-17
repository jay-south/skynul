import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as repo from '../core/repositories/secrets'

const secrets = new Hono()
  .get('/keys', (c) => c.json({ keys: repo.keys() }))
  .get('/:key', (c) => c.json({ value: repo.get(c.req.param('key')) }))
  .put('/:key', zValidator('json', z.object({ value: z.string() })), (c) => {
    repo.set(c.req.param('key'), c.req.valid('json').value); return c.json({ ok: true })
  })
  .get('/:key/exists', (c) => c.json({ exists: repo.has(c.req.param('key')) }))

export { secrets }
export type SecretsRoute = typeof secrets
