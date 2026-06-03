/**
 * D1 query helpers for the Hono worker.
 * All functions take `db: D1Database` explicitly — no global binding access.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Restaurant {
  slug: string
  name_zh: string
  address: string
  phone: string
  banner_path: string
  logo_path: string
  spreadsheet_id: string
  active: boolean
  tagline: string
  cutoff_hour: number
  location_ids: string[]   // parsed from JSON
  available_days: number[] // parsed from JSON
  min_order: number
  delivery_fee: number
  api_key: string
  line_channel_id: string
  line_channel_secret: string
  line_channel_access_token: string
}

export interface MenuItem {
  id: string
  restaurant_slug: string
  name_zh: string
  description: string
  price: number
  category: 'bento' | 'drink' | 'side'
  image_path: string
  available: boolean
  sort_order: number
}

export interface Building {
  id: string
  name_zh: string
  name: string
  lat: number
  lng: number
  sort_order: number
  active: boolean
}

export interface Coupon {
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_order: number
  max_uses: number
  max_uses_per_user: number
  max_discount: number | null
  start_date: string | null
  end_date: string | null
  active: boolean
}

export interface Order {
  order_number: string
  restaurant_slug: string
  line_user_id: string
  building_id: string
  delivery_date: string
  delivery_time: string | null
  status: string
  subtotal: number
  discount: number
  delivery_fee: number
  total: number
  coupon_code: string | null
  customer_name: string | null
  company: string | null
  phone: string | null
  special_note: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: number
  order_number: string
  menu_item_id: string
  name_zh: string
  qty: number
  unit_price: number
  category: string
}

export interface OrderStatusEvent {
  id: number
  order_number: string
  status: string
  source: string
  event_id: string | null
  note: string | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJSON<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

function mapRestaurant(r: Record<string, unknown>): Restaurant {
  return {
    slug: String(r.slug),
    name_zh: String(r.name_zh),
    address: String(r.address ?? ''),
    phone: String(r.phone ?? ''),
    banner_path: String(r.banner_path ?? ''),
    logo_path: String(r.logo_path ?? ''),
    spreadsheet_id: String(r.spreadsheet_id ?? ''),
    active: Boolean(r.active),
    tagline: String(r.tagline ?? ''),
    cutoff_hour: Number(r.cutoff_hour ?? 21),
    location_ids: parseJSON<string[]>(r.location_ids as string, []),
    available_days: parseJSON<number[]>(r.available_days as string, [1, 2, 3, 4, 5]),
    min_order: Number(r.min_order ?? 0),
    delivery_fee: Number(r.delivery_fee ?? 0),
    api_key: String(r.api_key ?? ''),
    line_channel_id: String(r.line_channel_id ?? ''),
    line_channel_secret: String(r.line_channel_secret ?? ''),
    line_channel_access_token: String(r.line_channel_access_token ?? ''),
  }
}

// ── Restaurants ────────────────────────────────────────────────────────────

export async function getRestaurant(db: D1Database, slug: string): Promise<Restaurant | null> {
  const row = await db.prepare('SELECT * FROM restaurants WHERE slug = ? AND active = 1').bind(slug).first<Record<string, unknown>>()
  return row ? mapRestaurant(row) : null
}

export async function listRestaurants(db: D1Database, locationId?: string, dayOfWeek?: number): Promise<Restaurant[]> {
  const rows = await db.prepare('SELECT * FROM restaurants WHERE active = 1 ORDER BY name_zh').all<Record<string, unknown>>()
  let list = rows.results.map(mapRestaurant)
  if (locationId) list = list.filter((r) => r.location_ids.includes(locationId))
  if (dayOfWeek !== undefined) list = list.filter((r) => r.available_days.includes(dayOfWeek))
  return list
}

// ── Menu ───────────────────────────────────────────────────────────────────

export async function listMenuItems(db: D1Database, restaurantSlug: string): Promise<MenuItem[]> {
  const rows = await db.prepare(
    'SELECT * FROM menu_items WHERE restaurant_slug = ? AND available = 1 ORDER BY sort_order, id'
  ).bind(restaurantSlug).all<Record<string, unknown>>()
  return rows.results.map((r) => ({
    id: String(r.id),
    restaurant_slug: String(r.restaurant_slug),
    name_zh: String(r.name_zh),
    description: String(r.description ?? ''),
    price: Number(r.price),
    category: String(r.category) as MenuItem['category'],
    image_path: String(r.image_path ?? ''),
    available: Boolean(r.available),
    sort_order: Number(r.sort_order ?? 0),
  }))
}

export async function getMenuItemsByIds(db: D1Database, ids: string[]): Promise<MenuItem[]> {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db.prepare(
    `SELECT * FROM menu_items WHERE id IN (${placeholders}) AND available = 1`
  ).bind(...ids).all<Record<string, unknown>>()
  return rows.results.map((r) => ({
    id: String(r.id),
    restaurant_slug: String(r.restaurant_slug),
    name_zh: String(r.name_zh),
    description: String(r.description ?? ''),
    price: Number(r.price),
    category: String(r.category) as MenuItem['category'],
    image_path: String(r.image_path ?? ''),
    available: Boolean(r.available),
    sort_order: Number(r.sort_order ?? 0),
  }))
}

// ── Buildings ──────────────────────────────────────────────────────────────

export async function listBuildings(db: D1Database): Promise<Building[]> {
  const rows = await db.prepare('SELECT * FROM buildings WHERE active = 1 ORDER BY sort_order, name_zh').all<Record<string, unknown>>()
  return rows.results.map((r) => ({
    id: String(r.id),
    name_zh: String(r.name_zh),
    name: String(r.name ?? ''),
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    sort_order: Number(r.sort_order ?? 0),
    active: Boolean(r.active),
  }))
}

// ── Coupons ────────────────────────────────────────────────────────────────

export async function getCoupon(db: D1Database, code: string): Promise<Coupon | null> {
  const row = await db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').bind(code.toUpperCase()).first<Record<string, unknown>>()
  if (!row) return null
  return {
    code: String(row.code),
    discount_type: String(row.discount_type) as Coupon['discount_type'],
    discount_value: Number(row.discount_value),
    min_order: Number(row.min_order ?? 0),
    max_uses: Number(row.max_uses ?? 999999),
    max_uses_per_user: Number(row.max_uses_per_user ?? 1),
    max_discount: row.max_discount != null ? Number(row.max_discount) : null,
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    active: Boolean(row.active),
  }
}

export async function countCouponUsage(db: D1Database, code: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_code = ?').bind(code).first<{ n: number }>()
  return row?.n ?? 0
}

export async function countCouponUsageByUser(db: D1Database, code: string, lineUserId: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_code = ? AND line_user_id = ?').bind(code, lineUserId).first<{ n: number }>()
  return row?.n ?? 0
}

// ── Orders ─────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  orderNumber: string
  restaurantSlug: string
  lineUserId: string
  buildingId: string
  deliveryDate: string
  deliveryTime?: string
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  couponCode?: string
  customerName?: string
  company?: string
  phone?: string
  specialNote?: string
  items: Array<{ menuItemId: string; nameZh: string; qty: number; unitPrice: number; category: string }>
}

export async function createOrder(db: D1Database, input: CreateOrderInput): Promise<void> {
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO orders (order_number, restaurant_slug, line_user_id, building_id, delivery_date, delivery_time,
        status, subtotal, discount, delivery_fee, total, coupon_code,
        customer_name, company, phone, special_note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      input.orderNumber, input.restaurantSlug, input.lineUserId, input.buildingId,
      input.deliveryDate, input.deliveryTime ?? null, 'pending',
      input.subtotal, input.discount, input.deliveryFee, input.total,
      input.couponCode ?? null, input.customerName ?? null,
      input.company ?? null, input.phone ?? null, input.specialNote ?? null,
      now, now
    ),
    ...input.items.map((item) =>
      db.prepare(`
        INSERT INTO order_items (order_number, menu_item_id, name_zh, qty, unit_price, category)
        VALUES (?,?,?,?,?,?)
      `).bind(input.orderNumber, item.menuItemId, item.nameZh, item.qty, item.unitPrice, item.category)
    ),
    // Initial status event
    db.prepare(`
      INSERT INTO order_status_events (order_number, status, source) VALUES (?,?,?)
    `).bind(input.orderNumber, 'pending', 'system'),
  ]

  if (input.couponCode) {
    statements.push(
      db.prepare(`
        INSERT OR IGNORE INTO coupon_redemptions (coupon_code, line_user_id, order_number) VALUES (?,?,?)
      `).bind(input.couponCode, input.lineUserId, input.orderNumber)
    )
  }

  await db.batch(statements)
}

export async function getOrder(db: D1Database, orderNumber: string): Promise<Order | null> {
  const row = await db.prepare('SELECT * FROM orders WHERE order_number = ?').bind(orderNumber).first<Record<string, unknown>>()
  if (!row) return null
  return row as unknown as Order
}

export async function listOrdersByUser(db: D1Database, lineUserId: string): Promise<Order[]> {
  const rows = await db.prepare(
    'SELECT * FROM orders WHERE line_user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(lineUserId).all<Record<string, unknown>>()
  return rows.results as unknown as Order[]
}

export async function getOrderItems(db: D1Database, orderNumber: string): Promise<OrderItem[]> {
  const rows = await db.prepare('SELECT * FROM order_items WHERE order_number = ?').bind(orderNumber).all<Record<string, unknown>>()
  return rows.results as unknown as OrderItem[]
}

export async function updateOrderStatus(
  db: D1Database,
  orderNumber: string,
  status: string,
  source: 'api' | 'webhook' | 'system',
  eventId?: string
): Promise<boolean> {
  const now = new Date().toISOString()
  try {
    await db.batch([
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE order_number = ?').bind(status, now, orderNumber),
      db.prepare(`
        INSERT OR IGNORE INTO order_status_events (order_number, status, source, event_id)
        VALUES (?,?,?,?)
      `).bind(orderNumber, status, source, eventId ?? null),
    ])
    return true
  } catch {
    return false
  }
}

export async function getOrderStatusEvents(db: D1Database, orderNumber: string): Promise<OrderStatusEvent[]> {
  const rows = await db.prepare(
    'SELECT * FROM order_status_events WHERE order_number = ? ORDER BY created_at ASC'
  ).bind(orderNumber).all<Record<string, unknown>>()
  return rows.results as unknown as OrderStatusEvent[]
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function upsertUser(db: D1Database, lineUserId: string, displayName: string, pictureUrl?: string): Promise<void> {
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO users (line_user_id, display_name, picture_url, created_at, updated_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(line_user_id) DO UPDATE SET
      display_name = excluded.display_name,
      picture_url = excluded.picture_url,
      updated_at = excluded.updated_at
  `).bind(lineUserId, displayName, pictureUrl ?? '', now, now).run()
}
