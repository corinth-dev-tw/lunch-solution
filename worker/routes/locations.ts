import { Hono } from 'hono'
import type { Env } from '../types'
import { listBuildings } from '../services/db'

export default new Hono<{ Bindings: Env }>()

  .get('/', async (c) => {
    const cacheKey = 'buildings:all'
    const cached = await c.env.CACHE.get(cacheKey)
    if (cached) return c.json({ locations: JSON.parse(cached) })

    const buildings = await listBuildings(c.env.DB)
    // Shape to match frontend Location type
    const locations = buildings.map((b) => ({
      id: b.id,
      name_zh: b.name_zh,
      name: b.name,
      coordinates: [b.lng, b.lat] as [number, number],
    }))
    await c.env.CACHE.put(cacheKey, JSON.stringify(locations), { expirationTtl: 300 })
    return c.json({ locations })
  })
