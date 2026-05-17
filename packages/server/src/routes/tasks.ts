import { zValidator } from '@hono/zod-validator'
import type { TaskCreateRequest, TaskListResponse } from '@skynul/shared'
import { TASK_CAPABILITY_IDS } from '@skynul/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { TaskManager } from '../core/agent/task-manager'
import { getPolicy } from './policy'

let tm: TaskManager | null = null
export function taskManager(): TaskManager {
  if (!tm) { tm = new TaskManager(); tm.setPolicyGetter(getPolicy); tm.init() }
  return tm
}

const taskCreateSchema = z.object({
  prompt: z.string().min(1),
  capabilities: z.array(z.enum(TASK_CAPABILITY_IDS)),
  attachments: z.array(z.string()).optional(),
  mode: z.enum(['browser', 'code']).optional().default('browser'),
  maxSteps: z.number().optional(),
  timeoutMs: z.number().optional(),
  source: z.enum(['desktop', 'telegram', 'discord', 'slack', 'whatsapp', 'signal']).optional(),
  parentTaskId: z.string().optional(),
  agentName: z.string().optional(),
  agentRole: z.string().optional()
}) satisfies z.ZodType<TaskCreateRequest>

const tasks = new Hono()
  .onError((err, c) => {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
  })
  .get('/', (c) => c.json({ tasks: taskManager().list() } as TaskListResponse))
  .get('/:id', (c) => {
    const task = taskManager().get(c.req.param('id'))
    if (!task) return c.json({ error: 'Task not found' }, 404)
    return c.json(task)
  })
  .post('/', zValidator('json', taskCreateSchema), (c) => {
    return c.json({ task: taskManager().create(c.req.valid('json')) })
  })
  .post('/:id/approve', async (c) => {
    return c.json({ task: await taskManager().approve(c.req.param('id')) })
  })
  .post('/:id/cancel', (c) => {
    return c.json({ task: taskManager().cancel(c.req.param('id')) })
  })
  .delete('/:id', (c) => { taskManager().delete(c.req.param('id')); return c.json({ ok: true }) })
  .post('/:id/message', zValidator('json', z.object({ message: z.string() })), (c) => {
    taskManager().sendMessage(c.req.param('id'), 'user', c.req.valid('json').message)
    return c.json({ ok: true })
  })

export { tasks }
export type TasksRoute = typeof tasks
