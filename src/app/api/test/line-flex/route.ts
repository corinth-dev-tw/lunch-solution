import { NextResponse } from 'next/server'
import { buildOrderFlexMessage } from '@/lib/line/messaging'
import type { Order, OrderStatus } from '@/types'

const mockOrder: Order = {
  id: 'TEST-001',
  order_number: 'SIAM-20260603-A1B2',
  member_id: 'U1234567890abcdef',
  restaurant_id: 'siammore',
  location_id: 'taipei-101',
  delivery_date: '2026-06-03',
  status: 'pending',
  subtotal: 720,
  discount: 50,
  delivery_fee: 0,
  total: 670,
  coupon_code: 'LUNCH50',
  special_note: '不要辣',
  items: [
    {
      id: 'item-1',
      order_id: 'TEST-001',
      menu_item_id: 'qtan',
      menu_item_name: 'Q彈好咖餐盒',
      quantity: 2,
      unit_price: 200,
      note: '',
    },
    {
      id: 'item-2',
      order_id: 'TEST-001',
      menu_item_id: 'milk-tea',
      menu_item_name: '泰式奶茶',
      quantity: 2,
      unit_price: 30,
      note: '',
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export async function GET() {
  const statuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled']

  const messages = statuses.map((status) => ({
    status,
    label: {
      pending: '待確認',
      confirmed: '已確認',
      preparing: '備餐中',
      ready: '可取餐',
      paid: '已付款',
      cancelled: '已取消',
    }[status],
    message: buildOrderFlexMessage(mockOrder, status),
  }))

  return NextResponse.json({
    _note: 'Copy any message.contents JSON into https://developers.line.biz/flex-simulator/',
    mockOrder: {
      order_number: mockOrder.order_number,
      total: mockOrder.total,
      items: mockOrder.items.map((i) => `${i.menu_item_name} x${i.quantity}`),
    },
    messages,
  })
}
