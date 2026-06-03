import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { pushOrderStatus } from '@/lib/line/messaging'
import { syncOrderToSheets } from '@/lib/google/sheets'
import { OrderStatus } from '@/types'

// Restaurant-facing status update endpoint (protected by a secret key)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authHeader = req.headers.get('x-restaurant-key')
  if (authHeader !== process.env.RESTAURANT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: { status: OrderStatus; restaurantId: string } = await req.json()
  const { status, restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  const validStatuses: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Single query: ownership check + update in one round-trip
  const { data: order, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select(`*, order_items(*), members(line_user_id, display_name), restaurants(name_zh)`)
    .single()

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const fullOrder = { ...order, items: order.order_items }

  // Push LINE Flex Message
  if (order.members?.line_user_id) {
    pushOrderStatus(order.members.line_user_id, fullOrder as never, status).catch(console.error)
  }

  // Sync to Sheets
  if (order.members && order.restaurants) {
    syncOrderToSheets(
      fullOrder as never,
      order.members.display_name,
      order.members.line_user_id,
      order.restaurants.name_zh
    ).catch(console.error)
  }

  return NextResponse.json({ ok: true, order: fullOrder })
}
