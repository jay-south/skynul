import { createMiddleware } from 'hono/factory'

const AUTH_TOKEN = process.env.SKYNUL_AUTH_TOKEN

/**
 * Auth middleware — validates Bearer token for desktop security.
 *
 * When SKYNUL_AUTH_TOKEN is set (production/packaged), all requests
 * must include `Authorization: Bearer <token>`.
 *
 * When unset (dev without Electron spawning), auth is skipped.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  if (!AUTH_TOKEN) {
    await next()
    return
  }

  const auth = c.req.header('authorization')
  if (!auth || auth !== `Bearer ${AUTH_TOKEN}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
  return
})
