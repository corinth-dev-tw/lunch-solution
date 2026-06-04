import { NextRequest, NextResponse } from 'next/server'
import { getOrderByNumber, updateOrderStatus, getOrderItems, getRestaurantConfig } from '@/lib/google/registry'
import { updateOrderStatus as updateSheetStatus } from '@/lib/google/sheets-edge'
import { pushOrderStatus } from '@/lib/line/messaging'
import { updateStatusSchema } from '@/lib/validation'
import type { OrderStatus } from '@/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderNumber = id

  const authHeader = req.headers.get('x-restaurant-key')
  if (authHeader !== process.env.RESTAURANT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { status } = parsed.data

  const order = await getOrderByNumber(orderNumber)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Update D1 (source of truth)
  await updateOrderStatus(orderNumber, status)

  // Update restaurant daily tab (best-effort)
  const config = await getRestaurantConfig(order.restaurantSlug)
  if (config?.spreadsheet_id) {
    await updateSheetStatus(config.spreadsheet_id, order.deliveryDate, orderNumber, status).catch((err) => {
      console.error('Failed to update restaurant sheet status:', err)
    })
  }

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
    const lineToken = config?.line_channel_access_token || undefined
    pushOrderStatus(order.lineUserId, lineOrder as never, status as OrderStatus, lineToken).catch(console.error)
  }

  return NextResponse.json({ ok: true, orderNumber, status })
}
