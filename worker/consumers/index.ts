/**
 * Cloudflare Queue consumer.
 * Handles all async side effects: Google Sheets writes and LINE push notifications.
 * Each message is retried up to 3× by Cloudflare automatically on non-ack.
 */

import type { Env, QueueMsg } from '../types'
import { getOrder, getOrderItems, getRestaurant } from '../services/db'

// Lazy-import heavy service modules so they only load when consumed
async function getSheets() {
  // We re-use the existing sheets-edge.ts logic but import dynamically
  // to avoid circular deps at worker init time
  const mod = await import('../../src/lib/google/sheets-edge')
  return mod
}

async function getLineMessaging() {
  const mod = await import('../../src/lib/line/messaging')
  return mod
}

// Exponential backoff: attempt 1→30s, 2→120s, 3→300s (5 min), then DLQ
const RETRY_DELAYS_SEC = [30, 120, 300]

export async function handleQueue(
  batch: MessageBatch<QueueMsg>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processMessage(msg.body, env)
      msg.ack()
    } catch (e) {
      const attempt = msg.attempts ?? 1
      const delaySeconds = RETRY_DELAYS_SEC[attempt - 1] ?? RETRY_DELAYS_SEC.at(-1)!
      console.error(`Queue consumer error [${msg.body.type}] attempt ${attempt}/${RETRY_DELAYS_SEC.length + 1}, retrying in ${delaySeconds}s:`, e)
      msg.retry({ delaySeconds })
    }
  }
}

async function processMessage(msg: QueueMsg, env: Env): Promise<void> {
  switch (msg.type) {
    case 'sheet.append_order':
      await handleSheetAppend(msg.orderNumber, env)
      break
    case 'sheet.update_status':
      await handleSheetStatus(msg.orderNumber, msg.status, env)
      break
    case 'line.push_status':
      await handleLinePush(msg.lineUserId, msg.orderNumber, msg.status, env, msg.lineToken)
      break
  }
}

// ── Sheet: append new order ────────────────────────────────────────────────

async function handleSheetAppend(orderNumber: string, env: Env): Promise<void> {
  const sheets = await getSheets()
  if (!sheets.isSheetsConfigured()) return

  const order = await getOrder(env.DB, orderNumber)
  if (!order) throw new Error(`Order ${orderNumber} not found`)

  const restaurant = await getRestaurant(env.DB, order.restaurant_slug)
  if (!restaurant?.spreadsheet_id) return  // no sheet configured — skip silently

  const items = await getOrderItems(env.DB, orderNumber)
  const bentos = items.filter((i) => i.category !== 'drink')
  const drinks = items.filter((i) => i.category === 'drink')

  await sheets.writeOrder(restaurant.spreadsheet_id, {
    orderNumber: order.order_number,
    deliveryDate: order.delivery_date,
    locationName: order.building_id,
    customerName: order.customer_name ?? '',
    company: order.company ?? '',
    phone: order.phone ?? '',
    lineUserId: order.line_user_id,
    bentoItems: bentos.map((i) => `${i.name_zh}×${i.qty}`).join(', '),
    bentoQty: bentos.reduce((s, i) => s + i.qty, 0),
    drinkItems: drinks.map((i) => `${i.name_zh}×${i.qty}`).join(', '),
    subtotal: order.subtotal,
    couponCode: order.coupon_code ?? '',
    discount: order.discount,
    total: order.total,
    note: order.special_note ?? '',
  })
}

// ── Sheet: update status column ────────────────────────────────────────────

async function handleSheetStatus(orderNumber: string, status: string, env: Env): Promise<void> {
  const sheets = await getSheets()
  if (!sheets.isSheetsConfigured()) return

  const order = await getOrder(env.DB, orderNumber)
  if (!order) throw new Error(`Order ${orderNumber} not found`)

  const restaurant = await getRestaurant(env.DB, order.restaurant_slug)
  if (!restaurant?.spreadsheet_id) return

  const label = sheets.STATUS_TO_LABEL?.[status] ?? status
  await sheets.updateOrderStatus(restaurant.spreadsheet_id, order.delivery_date, orderNumber, label)
}

// ── LINE: push status FlexMessage ──────────────────────────────────────────

async function handleLinePush(
  lineUserId: string,
  orderNumber: string,
  status: string,
  env: Env,
  lineToken?: string
): Promise<void> {
  const { pushOrderStatus } = await getLineMessaging()

  const order = await getOrder(env.DB, orderNumber)
  if (!order) throw new Error(`Order ${orderNumber} not found`)

  const items = await getOrderItems(env.DB, orderNumber)
  const flexOrder = {
    order_number: order.order_number,
    delivery_date: order.delivery_date,
    total: order.total,
    items: items.map((i) => ({ menu_item_name: i.name_zh, quantity: i.qty })),
  }

  // Use per-restaurant LINE OA token if available, else fall back to platform token
  const token = lineToken || undefined
  await pushOrderStatus(lineUserId, flexOrder as never, status as never, token)
}
