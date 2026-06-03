import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getRestaurantConfig,
  getCoupon,
  countCouponUsage,
  countCouponUsageByUser,
  appendCouponUsage,
  createOrder,
  readOrdersByUser,
  getOrderItems,
} from '@/lib/google/registry'
import { writeOrder } from '@/lib/google/sheets-edge'
import { pushOrderStatus } from '@/lib/line/messaging'
import { createOrderSchema } from '@/lib/validation'
import { generateOrderNumber, isBefore9amTaipei, getTodayTaipei } from '@/lib/utils'
import type { OrderRow } from '@/lib/google/sheets-edge'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    restaurantSlug,
    locationId,
    deliveryDate,
    items,
    couponCode,
    discount: clientDiscount,
    note,
    customerName,
    company,
    phone,
  } = parsed.data

  const config = await getRestaurantConfig(restaurantSlug)
  if (!config || !config.active) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  // Validate delivery date: today only before 9am Taipei time
  const todayStr = getTodayTaipei()
  if (deliveryDate === todayStr && !isBefore9amTaipei()) {
    return NextResponse.json({ error: '今日訂單已截止（09:00），請選擇明日或之後的日期' }, { status: 400 })
  }

  // Calculate totals
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  let discount = 0
  let validatedCouponCode = ''

  if (couponCode) {
    const coupon = await getCoupon(couponCode)
    if (coupon && coupon.active) {
      const usedCount = await countCouponUsage(couponCode)
      const userUsedCount = await countCouponUsageByUser(couponCode, session.lineUserId)
      const notExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date()
      const hasUsesLeft = usedCount < coupon.max_uses
      const userHasUsesLeft = userUsedCount < coupon.max_uses_per_user
      const meetsMinOrder = subtotal >= coupon.min_order

      if (notExpired && hasUsesLeft && userHasUsesLeft && meetsMinOrder) {
        discount = coupon.discount_type === 'fixed'
          ? Math.min(coupon.discount_value, subtotal)
          : Math.min(
              Math.floor((subtotal * coupon.discount_value) / 100),
              coupon.max_discount ?? Infinity
            )
        validatedCouponCode = couponCode
      }
    }
  }

  // Allow client-provided discount if coupon validation passed
  if (clientDiscount !== undefined && clientDiscount <= discount) {
    discount = clientDiscount
  }

  const deliveryFee = config.delivery_fee ?? 0
  const total = subtotal - discount + deliveryFee
  const orderNumber = generateOrderNumber()
  const now = new Date().toISOString()

  // Write to D1 (source of truth)
  try {
    await createOrder(
      {
        orderNumber,
        restaurantSlug,
        lineUserId: session.lineUserId,
        buildingId: locationId,
        deliveryDate,
        status: 'pending',
        subtotal,
        discount,
        deliveryFee,
        total,
        couponCode: validatedCouponCode,
        customerName: customerName || session.displayName,
        company: company || '',
        phone: phone || '',
        specialNote: note || '',
        createdAt: now,
      },
      items.map((i) => ({
        menuItemId: i.id,
        nameZh: i.name_zh,
        qty: i.qty,
        unitPrice: i.price,
        category: i.category,
      }))
    )
  } catch (e) {
    console.error('D1 order creation failed:', e)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // Log coupon usage
  if (validatedCouponCode) {
    appendCouponUsage(validatedCouponCode, session.lineUserId, orderNumber).catch(console.error)
  }

  // Best-effort: write to restaurant sheet (non-blocking)
  if (config.spreadsheet_id) {
    const bentos = items.filter((i) => i.category === 'bento' || i.category === 'side')
    const drinks = items.filter((i) => i.category === 'drink')
    const sheetRow: OrderRow = {
      orderNumber,
      deliveryDate,
      locationName: locationId,
      customerName: customerName || session.displayName,
      company: company || '',
      phone: phone || '',
      lineUserId: session.lineUserId,
      bentoItems: bentos.map((i) => `${i.name_zh}×${i.qty}`).join(', '),
      bentoQty: bentos.reduce((s, i) => s + i.qty, 0),
      drinkItems: drinks.map((i) => `${i.name_zh}×${i.qty}`).join(', '),
      subtotal,
      couponCode: validatedCouponCode,
      discount,
      total,
      note: note || '',
    }
    writeOrder(config.spreadsheet_id, sheetRow).catch((err) => {
      console.error('Restaurant sheet write failed:', err)
    })
  }

  // Send LINE push (non-blocking)
  const lineOrder = {
    order_number: orderNumber,
    delivery_date: deliveryDate,
    total,
    items: items.map((i) => ({
      menu_item_name: i.name_zh,
      quantity: i.qty,
    })),
  }
  const lineToken = config.line_channel_access_token || undefined
  pushOrderStatus(session.lineUserId, lineOrder as never, 'pending', lineToken).catch(console.error)

  return NextResponse.json({ order: { orderNumber, total, status: 'pending' } }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await readOrdersByUser(session.lineUserId)

  const orders = await Promise.all(
    rows.map(async (r) => {
      const items = await getOrderItems(r.orderNumber)
      return {
        id: r.orderNumber,
        order_number: r.orderNumber,
        member_id: r.lineUserId,
        restaurant_id: r.restaurantSlug,
        location_id: r.buildingId,
        delivery_date: r.deliveryDate,
        status: r.status,
        subtotal: r.subtotal,
        discount: r.discount,
        delivery_fee: r.deliveryFee,
        total: r.total,
        coupon_code: r.couponCode,
        special_note: r.specialNote,
        items: items.map((i) => ({
          id: i.menuItemId,
          menu_item_name: i.nameZh,
          quantity: i.qty,
          unit_price: i.unitPrice,
        })),
        created_at: r.createdAt,
        updated_at: r.createdAt,
      }
    })
  )

  return NextResponse.json({ orders })
}
