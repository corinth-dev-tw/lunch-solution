import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types'
import { getOrder, getRestaurant, updateOrderStatus } from '../services/db'
import { verifySheetsSig } from '../middleware/hmac'

// Map Sheets status labels → internal status
const LABEL_TO_STATUS: Record<string, string> = {
  '⚪ 待確認': 'pending',
  '🟡 已受理': 'confirmed',
  '🟡 製作中': 'preparing',
  '🟢 已出餐': 'ready',
  '💰 已收款': 'paid',
  '❌ 已取消': 'cancelled',
}

const schema = z.object({
  orderNumber: z.string().min(1),
  status: z.string().min(1),         // sheet label or internal status key
  restaurantSlug: z.string().min(1),
  signature: z.string().min(1),
  eventId: z.string().optional(),    // dedup key
})

export default new Hono<{ Bindings: Env }>()

  .post('/sheet-status', zValidator('json', schema), async (c) => {
    const { orderNumber, status: rawStatus, restaurantSlug, signature, eventId } = c.req.valid('json')

    // Look up restaurant to get api_key for HMAC verification
    const restaurant = await getRestaurant(c.env.DB, restaurantSlug)
    if (!restaurant) return c.json({ error: 'Restaurant not found' }, 404)

    const sigPayload = `${orderNumber}:${rawStatus}:${restaurantSlug}`
    const valid = await verifySheetsSig(sigPayload, restaurant.api_key, signature)
    if (!valid) return c.json({ error: 'Invalid signature' }, 401)

    // Resolve status label
    const internalStatus = LABEL_TO_STATUS[rawStatus] ?? rawStatus
    const allowed = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled']
    if (!allowed.includes(internalStatus)) return c.json({ error: 'Invalid status' }, 400)

    // Verify order belongs to restaurant
    const order = await getOrder(c.env.DB, orderNumber)
    if (!order || order.restaurant_slug !== restaurantSlug) {
      return c.json({ error: 'Order not found' }, 404)
    }

    // Update D1 (dedup via UNIQUE index on event_id)
    await updateOrderStatus(c.env.DB, orderNumber, internalStatus, 'webhook', eventId)

    // Enqueue LINE push
    c.env.ORDER_QUEUE.send({
      type: 'line.push_status',
      lineUserId: order.line_user_id,
      orderNumber,
      status: internalStatus,
      lineToken: restaurant.line_channel_access_token || undefined,
    })

    return c.json({ ok: true })
  })
