import { zValidator } from '@hono/zod-validator'
import type { Schedule } from '@skynul/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import * as repo from '../core/repositories/schedules'

const scheduleSchema = z.object({
  id: z.string().optional(), prompt: z.string().min(1), capabilities: z.array(z.string()),
  mode: z.enum(['browser', 'code']), frequency: z.enum(['daily', 'weekly', 'custom']),
  cronExpr: z.string(), enabled: z.boolean().optional().default(true)
})

const schedules = new Hono()
  .get('/', (c) => c.json({ schedules: repo.list() }))
  .post('/', zValidator('json', scheduleSchema), (c) => {
    const body = c.req.valid('json')
    const now = Date.now()
    if (body.id) {
      repo.update(body.id, {
        prompt: body.prompt, capabilities: body.capabilities as Schedule['capabilities'],
        mode: body.mode, frequency: body.frequency, cronExpr: body.cronExpr, enabled: body.enabled
      })
    } else {
      repo.create(body.prompt, JSON.stringify(body.capabilities), body.mode, body.frequency, body.cronExpr, now)
    }
    return c.json({ schedules: repo.list() })
  })
  .delete('/:id', (c) => { repo.remove(c.req.param('id')); return c.json({ schedules: repo.list() }) })
  .put('/:id/toggle', (c) => { repo.toggle(c.req.param('id')); return c.json({ schedules: repo.list() }) })

export { schedules }
export type SchedulesRoute = typeof schedules
