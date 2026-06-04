import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types'
import { authRequired } from '../middleware/auth'
import {
  getRestaurant, getMenuItemsByIds, getCoupon,
  countCouponUsage, countCouponUsageByUser,
  createOrder, listOrdersByUser, getOrder, getOrderItems, getOrderStatusEvents,
} from '../services/db'
import { formatInTimeZone } from 'date-fns-tz'

const itemSchema = z.object({
  id: z.string().min(1),
  name_zh: z.string().min(1),
  qty: z.number().int().min(1),
  price: z.number().int().min(0),
  category: z.string().min(1),
})

const createOrderSchema = z.object({
  restaurantSlug: z.string().min(1),
  locationId: z.string().min(1),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryTime: z.string().optional(),
  items: z.array(itemSchema).min(1),
  couponCode: z.string().optional(),
  note: z.string().optional(),
  customerName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
})

function generateOrderNumber(): string {
  const datePart = formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyyMMdd')
  // 10 hex chars from crypto.randomUUID() — 40 bits of entropy, no collision check needed
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase()
  return `LN-${datePart}-${rand}`
}

function getTodayTaipei(): string {
  return formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyy-MM-dd')
}

function getCurrentHourTaipei(): number {
  return parseInt(formatInTimeZone(new Date(), 'Asia/Taipei', 'H'))
}

export default new Hono<{ Bindings: Env }>()

  // POST /api/orders
  .post('/', authRequired, zValidator('json', createOrderSchema), async (c) => {
    const session = c.get('session')
    const data = c.req.valid('json')
    const { restaurantSlug, locationId, deliveryDate, deliveryTime, items, couponCode, note, customerName, company, phone } = data

    // Validate restaurant
    const restaurant = await getRestaurant(c.env.DB, restaurantSlug)
    if (!restaurant || !restaurant.active) return c.json({ error: 'Restaurant not found' }, 404)

    // Validate delivery date (same-day only before 09:00 Taipei)
    const today = getTodayTaipei()
    if (deliveryDate === today && getCurrentHourTaipei() >= 9) {
      return c.json({ error: '今日訂單已截止（09:00），請選擇明日或之後的日期' }, 400)
    }

    // Validate prices from D1 (not client)
    const menuItems = await getMenuItemsByIds(c.env.DB, items.map((i) => i.id))
    const menuMap = new Map(menuItems.map((m) => [m.id, m]))
    for (const item of items) {
      const dbItem = menuMap.get(item.id)
      if (!dbItem) return c.json({ error: `Menu item ${item.id} not found` }, 400)
      if (dbItem.restaurant_slug !== restaurantSlug) return c.json({ error: `Menu item ${item.id} not in restaurant` }, 400)
    }

    const subtotal = items.reduce((s, i) => {
      const dbItem = menuMap.get(i.id)!
      return s + dbItem.price * i.qty
    }, 0)

    // Validate coupon
    let discount = 0
    let validCoupon = ''
    if (couponCode) {
      const coupon = await getCoupon(c.env.DB, couponCode)
      if (coupon && coupon.active) {
        const now = new Date().toISOString().slice(0, 10)
        const notExpired = !coupon.end_date || coupon.end_date >= now
        const notStarted = coupon.start_date && coupon.start_date > now
        const globalOk = (await countCouponUsage(c.env.DB, coupon.code)) < coupon.max_uses
        const userOk = (await countCouponUsageByUser(c.env.DB, coupon.code, session.lineUserId)) < coupon.max_uses_per_user
        const minOk = subtotal >= coupon.min_order

        if (notExpired && !notStarted && globalOk && userOk && minOk) {
          discount = coupon.discount_type === 'fixed'
            ? Math.min(coupon.discount_value, subtotal)
            : Math.min(
                Math.floor(subtotal * coupon.discount_value / 100),
                coupon.max_discount ?? Infinity
              )
          validCoupon = coupon.code
        }
      }
    }

    const deliveryFee = restaurant.delivery_fee ?? 0
    const total = subtotal - discount + deliveryFee
    const orderNumber = generateOrderNumber()

    // Write to D1 atomically
    await createOrder(c.env.DB, {
      orderNumber,
      restaurantSlug,
      lineUserId: session.lineUserId,
      buildingId: locationId,
      deliveryDate,
      deliveryTime,
      subtotal,
      discount,
      deliveryFee,
      total,
      couponCode: validCoupon || undefined,
      customerName: customerName || session.displayName,
      company: company || '',
      phone: phone || '',
      specialNote: note || '',
      items: items.map((i) => ({
        menuItemId: i.id,
        nameZh: menuMap.get(i.id)!.name_zh,
        qty: i.qty,
        unitPrice: menuMap.get(i.id)!.price,
        category: menuMap.get(i.id)!.category,
      })),
    })

    // Enqueue side effects (non-blocking)
    c.env.ORDER_QUEUE.send({ type: 'sheet.append_order', orderNumber })
    c.env.ORDER_QUEUE.send({
      type: 'line.push_status',
      lineUserId: session.lineUserId,
      orderNumber,
      status: 'pending',
      lineToken: restaurant.line_channel_access_token || undefined,
    })

    return c.json({ order: { orderNumber, total, status: 'pending' } }, 201)
  })

  // GET /api/orders
  .get('/', authRequired, async (c) => {
    const session = c.get('session')
    const orders = await listOrdersByUser(c.env.DB, session.lineUserId)
    const withItems = await Promise.all(
      orders.map(async (o) => ({
        ...o,
        items: await getOrderItems(c.env.DB, o.order_number),
      }))
    )
    return c.json({ orders: withItems })
  })

  // GET /api/orders/:id
  .get('/:id', authRequired, async (c) => {
    const session = c.get('session')
    const order = await getOrder(c.env.DB, c.req.param('id'))
    if (!order) return c.json({ error: 'Not found' }, 404)
    if (order.line_user_id !== session.lineUserId) return c.json({ error: 'Forbidden' }, 403)

    const [items, events] = await Promise.all([
      getOrderItems(c.env.DB, order.order_number),
      getOrderStatusEvents(c.env.DB, order.order_number),
    ])
    return c.json({ order: { ...order, items, statusHistory: events } })
  })
