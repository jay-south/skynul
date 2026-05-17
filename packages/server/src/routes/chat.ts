import { zValidator } from '@hono/zod-validator'
import type { ChatSendResponse } from '@skynul/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { dispatchChat } from '../core/transport/providers/dispatch'
import { getPolicy } from './policy'

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
})

const chat = new Hono().post(
  '/send',
  zValidator(
    'json',
    z.object({
      messages: z.array(chatMessageSchema).min(1)
    })
  ),
  async (c) => {
    if (!getPolicy().capabilities['net.http']) {
      return c.json({ error: 'Capability net.http is disabled' }, 403)
    }

    const { messages } = c.req.valid('json')
    try {
      const content = await dispatchChat(getPolicy().provider.active, messages)
      const response: ChatSendResponse = { content }
      return c.json(response)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ error: msg }, 400)
    }
  }
)

export { chat }
export type ChatRoute = typeof chat
