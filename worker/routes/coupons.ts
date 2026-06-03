import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types'
import { authRequired } from '../middleware/auth'
import { getCoupon, countCouponUsage, countCouponUsageByUser } from '../services/db'

export default new Hono<{ Bindings: Env }>()

  .get('/validate', authRequired, zValidator('query', z.object({
    code: z.string().min(1),
    subtotal: z.string().regex(/^\d+$/),
  })), async (c) => {
    const session = c.get('session')
    const { code, subtotal: subtotalStr } = c.req.valid('query')
    const subtotal = parseInt(subtotalStr)

    const coupon = await getCoupon(c.env.DB, code)
    if (!coupon || !coupon.active) return c.json({ error: '優惠券無效' }, 400)

    const now = new Date().toISOString().slice(0, 10)
    if (coupon.end_date && coupon.end_date < now) return c.json({ error: '優惠券已過期' }, 400)
    if (coupon.start_date && coupon.start_date > now) return c.json({ error: '優惠券尚未生效' }, 400)
    if (subtotal < coupon.min_order) return c.json({ error: `最低消費 NT$${coupon.min_order}` }, 400)

    const globalUsed = await countCouponUsage(c.env.DB, coupon.code)
    if (globalUsed >= coupon.max_uses) return c.json({ error: '優惠券已全數使用' }, 400)

    const userUsed = await countCouponUsageByUser(c.env.DB, coupon.code, session.lineUserId)
    if (userUsed >= coupon.max_uses_per_user) return c.json({ error: '您已使用過此優惠券' }, 400)

    const discount = coupon.discount_type === 'fixed'
      ? Math.min(coupon.discount_value, subtotal)
      : Math.min(
          Math.floor(subtotal * coupon.discount_value / 100),
          coupon.max_discount ?? Infinity
        )

    return c.json({ discount, coupon: { code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value } })
  })
