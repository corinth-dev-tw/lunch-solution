import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { pushOrderStatus } from '@/lib/line/messaging'
import { syncOrderToSheets, ensureSheetHeaders } from '@/lib/google/sheets'
import { generateOrderNumber } from '@/lib/utils'
import { CartItem } from '@/types'

interface OrderBody {
  restaurantId: string
  locationId: string
  deliveryDate: string
  items: CartItem[]
  couponCode?: string
  couponId?: string
  discount?: number
  specialNote?: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: OrderBody = await req.json()
  const { restaurantId, locationId, deliveryDate, items, couponCode, couponId, discount = 0, specialNote } = body

  if (!items?.length) return NextResponse.json({ error: 'No items' }, { status: 400 })

  let supabase
  try {
    supabase = await createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  // Fetch restaurant for delivery fee
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, name_zh, delivery_fee')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const subtotal = items.reduce((s, i) => s + i.menu_item.price * i.quantity, 0)
  const deliveryFee = restaurant.delivery_fee ?? 0
  const total = subtotal - discount + deliveryFee
  const orderNumber = generateOrderNumber()

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      member_id: session.memberId,
      restaurant_id: restaurantId,
      location_id: locationId,
      delivery_date: deliveryDate,
      status: 'pending',
      subtotal,
      discount,
      delivery_fee: deliveryFee,
      total,
      coupon_code: couponCode ?? null,
      coupon_id: couponId ?? null,
      special_note: specialNote ?? null,
    })
    .select()
    .single()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Insert order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menu_item.id,
    menu_item_name: item.menu_item.name_zh,
    quantity: item.quantity,
    unit_price: item.menu_item.price,
    note: item.note ?? null,
  }))

  await supabase.from('order_items').insert(orderItems)

  // Increment coupon usage
  if (couponId) {
    await supabase.rpc('increment_coupon_usage', { coupon_id: couponId })
  }

  const fullOrder = {
    ...order,
    items: orderItems.map((oi, idx) => ({
      ...oi,
      id: `temp-${idx}`,
    })),
  }

  // Push LINE Flex Message (non-blocking)
  pushOrderStatus(session.lineUserId, fullOrder as never, 'pending').catch(console.error)

  // Sync to Google Sheets (non-blocking)
  ensureSheetHeaders()
    .then(() => syncOrderToSheets(fullOrder as never, session.displayName, session.lineUserId, restaurant.name_zh))
    .catch(console.error)

  return NextResponse.json({ order: fullOrder }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let supabase
  try {
    supabase = await createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('member_id', session.memberId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}
