/**
 * Test script: generate LINE Flex Message JSON for all order statuses.
 *
 * Run:
 *   npx tsx scripts/test-line-flex.ts
 *
 * Then copy the JSON output and paste into:
 *   https://developers.line.biz/flex-simulator/
 */

import { buildOrderFlexMessage } from '../src/lib/line/messaging'
import { Order, OrderStatus } from '../src/types'

// Provide fallback for NEXT_PUBLIC_APP_URL when running outside Next.js
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lunch.antu-technology.com'

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

const statuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled']

console.log('═══════════════════════════════════════════════════════════')
console.log('LINE Flex Message — Order Status Test Output')
console.log('═══════════════════════════════════════════════════════════')
console.log()
console.log('Copy any of the JSON blocks below and paste into:')
console.log('https://developers.line.biz/flex-simulator/')
console.log()

for (const status of statuses) {
  const message = buildOrderFlexMessage(mockOrder, status)
  console.log(`─── Status: ${status} ──────────────────────────────────────`)
  console.log(JSON.stringify(message, null, 2))
  console.log()
}

console.log('═══════════════════════════════════════════════════════════')
console.log('All statuses generated. Use the Flex Simulator to preview.')
console.log('═══════════════════════════════════════════════════════════')
