import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as repo from '../core/repositories/projects'

const projects = new Hono()
  .get('/', (c) => c.json({ projects: repo.list() }))
  .post('/', zValidator('json', z.object({ name: z.string().min(1), color: z.string().optional() })), (c) =>
    c.json(repo.create(c.req.valid('json').name, c.req.valid('json').color)))
  .put('/:id', zValidator('json', z.object({ name: z.string().min(1), color: z.string() })), (c) => {
    repo.update(c.req.param('id'), c.req.valid('json').name, c.req.valid('json').color); return c.json({ ok: true })
  })
  .delete('/:id', (c) => { repo.remove(c.req.param('id')); return c.json({ ok: true }) })
  .post('/:id/tasks/:taskId', (c) => { repo.addTask(c.req.param('id'), c.req.param('taskId')); return c.json({ ok: true }) })
  .delete('/:id/tasks/:taskId', (c) => { repo.removeTask(c.req.param('id'), c.req.param('taskId')); return c.json({ ok: true }) })

export { projects }
export type ProjectsRoute = typeof projects
