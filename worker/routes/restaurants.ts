import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types'
import { listRestaurants, getRestaurant, listMenuItems } from '../services/db'

const CACHE_TTL = 300 // 5 minutes

export default new Hono<{ Bindings: Env }>()

  // GET /api/restaurants?location=taipei-101&date=2026-06-10
  .get('/', zValidator('query', z.object({
    location: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })), async (c) => {
    const { location, date } = c.req.valid('query')
    const dayOfWeek = date ? new Date(date + 'T12:00:00').getDay() : undefined

    const cacheKey = `restaurants:${location ?? 'all'}:${dayOfWeek ?? 'any'}`
    const cached = await c.env.CACHE.get(cacheKey)
    if (cached) return c.json({ restaurants: JSON.parse(cached) })

    const restaurants = await listRestaurants(c.env.DB, location, dayOfWeek)
    await c.env.CACHE.put(cacheKey, JSON.stringify(restaurants), { expirationTtl: CACHE_TTL })
    return c.json({ restaurants })
  })

  // GET /api/restaurants/:slug
  .get('/:slug', async (c) => {
    const { slug } = c.req.param()
    const restaurant = await getRestaurant(c.env.DB, slug)
    if (!restaurant) return c.json({ error: 'Not found' }, 404)
    // Strip sensitive fields
    const { api_key, line_channel_secret, line_channel_access_token, ...safe } = restaurant
    return c.json({ restaurant: safe })
  })

  // GET /api/restaurants/:slug/menu
  .get('/:slug/menu', async (c) => {
    const { slug } = c.req.param()
    const cacheKey = `menu:${slug}`
    const cached = await c.env.CACHE.get(cacheKey)
    if (cached) return c.json({ items: JSON.parse(cached) })

    const items = await listMenuItems(c.env.DB, slug)
    await c.env.CACHE.put(cacheKey, JSON.stringify(items), { expirationTtl: CACHE_TTL })
    return c.json({ items })
  })
