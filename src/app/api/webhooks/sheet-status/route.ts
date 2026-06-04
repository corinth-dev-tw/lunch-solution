import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantConfig, getOrderByNumber, updateOrderStatus, getOrderItems } from '@/lib/google/registry'
import { pushOrderStatus } from '@/lib/line/messaging'
import { LABEL_TO_STATUS } from '@/lib/google/sheets-edge'
import { sheetWebhookSchema } from '@/lib/validation'
import type { OrderStatus } from '@/types'

async function verifySignature(payload: string, secret: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  let sigBytes: Uint8Array
  try {
    sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  // Constant-time comparison to prevent timing side-channels
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = sheetWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { orderNumber, status: rawStatus, restaurantSlug, signature } = parsed.data

  const config = await getRestaurantConfig(restaurantSlug)
  if (!config) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const valid = await verifySignature(
    `${orderNumber}:${rawStatus}:${restaurantSlug}`,
    config.api_key,
    signature
  )
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const order = await getOrderByNumber(orderNumber)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Map Chinese sheet label back to English status enum
  const status = (LABEL_TO_STATUS[rawStatus] ?? rawStatus) as OrderStatus

  // Update D1 (source of truth)
  await updateOrderStatus(orderNumber, status)

  // Send LINE push
  if (order.lineUserId) {
    const items = await getOrderItems(orderNumber)
    const lineOrder = {
      order_number: orderNumber,
      delivery_date: order.deliveryDate,
      total: order.total,
      items: items.map((i) => ({
        menu_item_name: i.nameZh,
        quantity: i.qty,
      })),
    }
    const lineToken = config.line_channel_access_token || undefined
    pushOrderStatus(order.lineUserId, lineOrder as never, status, lineToken).catch(console.error)
  }

  return NextResponse.json({ ok: true, orderNumber, status })
}
