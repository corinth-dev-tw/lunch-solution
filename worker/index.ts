import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env, QueueMsg } from './types'
import { handleQueue } from './consumers'
import authRoutes from './routes/auth'
import restaurantRoutes from './routes/restaurants'
import orderRoutes from './routes/orders'
import locationRoutes from './routes/locations'
import couponRoutes from './routes/coupons'
import webhookRoutes from './routes/webhooks'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())

// Security headers on all responses
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'DENY')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
  if (c.req.url.startsWith('https://')) {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
app.use('/api/*', cors({
  origin: (origin, c) => {
    const allowed = [
      c.env.APP_URL,
      'http://localhost:3000',
      'http://localhost:5173',
    ].filter(Boolean)
    return allowed.includes(origin) ? origin : null
  },
  allowHeaders: ['Content-Type', 'Authorization', 'x-restaurant-key'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// ── API routes ─────────────────────────────────────────────────────────────
app.route('/api/auth', authRoutes)
app.route('/api/restaurants', restaurantRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/locations', locationRoutes)
app.route('/api/coupons', couponRoutes)
app.route('/api/webhooks', webhookRoutes)

// ── SPA fallback — serve index.html for all non-API routes ─────────────────
app.get('*', async (c) => {
  // Workers Assets binding serves static files; fall back to index.html for SPA routes
  const url = new URL(c.req.url)
  if (url.pathname.startsWith('/api/')) return c.json({ error: 'Not found' }, 404)
  // Try exact asset, then fall back to SPA shell
  return c.env.ASSETS.fetch(c.req.raw)
})

export default {
  fetch: app.fetch,

  // Queue consumer export
  async queue(batch: MessageBatch<QueueMsg>, env: Env): Promise<void> {
    await handleQueue(batch, env)
  },
}
