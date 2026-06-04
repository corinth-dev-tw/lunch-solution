import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import type { Env } from '../types'

export interface Session {
  lineUserId: string
  displayName: string
  pictureUrl?: string
}

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export const authRequired = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = getCookie(c, 'lunch_session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const secret = new TextEncoder().encode(c.env.SESSION_SECRET)
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })
    c.set('session', {
      lineUserId: payload.lineUserId as string,
      displayName: payload.displayName as string,
      pictureUrl: payload.pictureUrl as string | undefined,
    })
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

export const adminRequired = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.req.header('x-restaurant-key') !== c.env.RESTAURANT_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})
