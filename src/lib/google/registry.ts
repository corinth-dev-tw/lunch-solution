/**
 * D1-based registry.
 * Reads restaurant configs, menus, users, coupons, and orders from Cloudflare D1.
 * Falls back to DEV_CONFIG when D1 is not yet configured (local dev without DB).
 */

import { dbQuery, dbQueryFirst, dbRun, dbBatch } from '@/lib/db/client'
import { LineProfile } from '@/types'

export interface RestaurantConfig {
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
  location_ids: string[]
  available_days: number[]
  min_order: number
  delivery_fee: number
  api_key: string
  line_channel_id: string
  line_channel_secret: string
  line_channel_access_token: string
}

export interface MenuItemConfig {
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

// ── Dev fallback (used when D1 is not available) ───────────────────────────
export const DEV_RESTAURANTS: RestaurantConfig[] = [
  {
    slug: 'siammore',
    name_zh: '饗泰多 松高店',
    address: '台北市信義區松高路16號3樓',
    phone: '02-27221728',
    banner_path: '/siammore/banners/banner-siammore.jpg',
    logo_path: '/siammore/logo/siammore logo.png',
    spreadsheet_id: '',
    active: true,
    tagline: '雙主菜 + 三配菜 · 超有料餐盒',
    cutoff_hour: 21,
    location_ids: ['taipei-101', 'exchange-square', 'shin-kong-mitsukoshi', 'world-trade-center'],
    available_days: [1, 2, 3, 4, 5],
    min_order: 0,
    delivery_fee: 0,
    api_key: 'dev-key-siammore',
    line_channel_id: '',
    line_channel_secret: '',
    line_channel_access_token: '',
  },
]

export const DEV_MENU: MenuItemConfig[] = [
  { id: 'qtan', restaurant_slug: 'siammore', name_zh: 'Q彈好咖餐盒', description: 'Q彈脆口「酥炸松阪豬」+濃香滑順「黃金咖喱雞」', price: 200, category: 'bento', image_path: '/siammore/products/qtan-bento.jpg', available: true, sort_order: 1 },
  { id: 'basil', restaurant_slug: 'siammore', name_zh: '開胃扒飯餐盒', description: '經典白飯殺手「扒飯打拋豬」+酸甜開胃「泰式手撕雞涼拌」', price: 200, category: 'bento', image_path: '/siammore/products/basil-bento.jpg', available: true, sort_order: 2 },
  { id: 'kacha', restaurant_slug: 'siammore', name_zh: '咔滋爆爽餐盒', description: '酥脆多汁「咔滋椒麻雞」+鹹香下飯「蠔氣爆炒牛」', price: 200, category: 'bento', image_path: '/siammore/products/kacha-bento.jpg', available: true, sort_order: 3 },
  { id: 'milk-tea', restaurant_slug: 'siammore', name_zh: '泰式奶茶', description: '濃郁奶香，泰式經典', price: 30, category: 'drink', image_path: '/siammore/products/thai-milk-tea.jpg', available: true, sort_order: 4 },
  { id: 'lemon', restaurant_slug: 'siammore', name_zh: '檸檬茶', description: '清爽酸甜，消暑解膩', price: 20, category: 'drink', image_path: '/siammore/products/lemon-drink.jpg', available: true, sort_order: 5 },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function parseList(str: string | null): string[] {
  if (!str) return []
  try {
    const parsed = JSON.parse(str)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return str.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

function parseIntList(str: string | null): number[] {
  if (!str) return []
  try {
    const parsed = JSON.parse(str)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return str.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  }
}

function mapRestaurantRow(row: Record<string, unknown>): RestaurantConfig {
  return {
    slug: String(row.slug),
    name_zh: String(row.name_zh),
    address: String(row.address ?? ''),
    phone: String(row.phone ?? ''),
    banner_path: String(row.banner_path ?? ''),
    logo_path: String(row.logo_path ?? ''),
    spreadsheet_id: String(row.spreadsheet_id ?? ''),
    active: row.active === 1 || row.active === true,
    tagline: String(row.tagline ?? ''),
    cutoff_hour: Number(row.cutoff_hour ?? 21),
    location_ids: parseList(row.location_ids as string | null),
    available_days: parseIntList(row.available_days as string | null),
    min_order: Number(row.min_order ?? 0),
    delivery_fee: Number(row.delivery_fee ?? 0),
    api_key: String(row.api_key ?? ''),
    line_channel_id: String(row.line_channel_id ?? ''),
    line_channel_secret: String(row.line_channel_secret ?? ''),
    line_channel_access_token: String(row.line_channel_access_token ?? ''),
  }
}

function mapMenuRow(row: Record<string, unknown>): MenuItemConfig {
  return {
    id: String(row.id),
    restaurant_slug: String(row.restaurant_slug),
    name_zh: String(row.name_zh),
    description: String(row.description ?? ''),
    price: Number(row.price ?? 0),
    category: String(row.category ?? 'bento') as MenuItemConfig['category'],
    image_path: String(row.image_path ?? ''),
    available: row.available === 1 || row.available === true,
    sort_order: Number(row.sort_order ?? 99),
  }
}

// ── Restaurants ────────────────────────────────────────────────────────────

export async function getRestaurantConfig(slug: string): Promise<RestaurantConfig | null> {
  try {
    const row = await dbQueryFirst<Record<string, unknown>>(
      'SELECT * FROM restaurants WHERE slug = ? AND active = 1',
      [slug]
    )
    if (!row) return null
    return mapRestaurantRow(row)
  } catch (e) {
    console.warn('D1 getRestaurantConfig failed, using dev fallback:', e)
    return DEV_RESTAURANTS.find((r) => r.slug === slug) ?? null
  }
}

export async function getAllRestaurants(): Promise<RestaurantConfig[]> {
  try {
    const res = await dbQuery<Record<string, unknown>>(
      'SELECT * FROM restaurants WHERE active = 1 ORDER BY name_zh'
    )
    return res.results.map(mapRestaurantRow)
  } catch (e) {
    console.warn('D1 getAllRestaurants failed, using dev fallback:', e)
    return DEV_RESTAURANTS.filter((r) => r.active)
  }
}

export async function getRestaurants(locationId: string, dayOfWeek: number): Promise<RestaurantConfig[]> {
  const all = await getAllRestaurants()
  return all.filter((r) =>
    r.location_ids.includes(locationId) &&
    r.available_days.includes(dayOfWeek)
  )
}

// ── Menu Items ─────────────────────────────────────────────────────────────

export async function getMenuItems(slug: string): Promise<MenuItemConfig[]> {
  try {
    const res = await dbQuery<Record<string, unknown>>(
      'SELECT * FROM menu_items WHERE restaurant_slug = ? AND available = 1 ORDER BY sort_order, id',
      [slug]
    )
    return res.results.map(mapMenuRow)
  } catch (e) {
    console.warn('D1 getMenuItems failed, using dev fallback:', e)
    return DEV_MENU.filter((m) => m.restaurant_slug === slug && m.available)
  }
}

// ── Users (LINE members) ───────────────────────────────────────────────────

export async function upsertMember(profile: LineProfile): Promise<void> {
  try {
    const existing = await dbQueryFirst<Record<string, unknown>>(
      'SELECT line_user_id FROM users WHERE line_user_id = ?',
      [profile.userId]
    )
    const now = new Date().toISOString()
    if (existing) {
      await dbRun(
        'UPDATE users SET display_name = ?, picture_url = ?, updated_at = ? WHERE line_user_id = ?',
        [profile.displayName, profile.pictureUrl ?? '', now, profile.userId]
      )
    } else {
      await dbRun(
        'INSERT INTO users (line_user_id, display_name, picture_url, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [profile.userId, profile.displayName, profile.pictureUrl ?? '', profile.language ?? 'zh-TW', now, now]
      )
    }
  } catch (e) {
    console.error('D1 upsertMember error:', e)
  }
}

export async function getUser(lineUserId: string): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try {
    const row = await dbQueryFirst<Record<string, unknown>>(
      'SELECT display_name, picture_url FROM users WHERE line_user_id = ?',
      [lineUserId]
    )
    if (!row) return null
    return {
      displayName: String(row.display_name),
      pictureUrl: row.picture_url ? String(row.picture_url) : undefined,
    }
  } catch (e) {
    console.error('D1 getUser error:', e)
    return null
  }
}

// ── Coupons ────────────────────────────────────────────────────────────────

export interface CouponConfig {
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_order: number
  max_uses: number
  max_uses_per_user: number
  max_discount?: number
  used_count: number
  expires_at: string | null
  active: boolean
}

function mapCouponRow(row: Record<string, unknown>): CouponConfig {
  return {
    code: String(row.code),
    discount_type: String(row.discount_type) as 'fixed' | 'percent',
    discount_value: Number(row.discount_value ?? 0),
    min_order: Number(row.min_order ?? 0),
    max_uses: Number(row.max_uses ?? 999999),
    max_uses_per_user: Number(row.max_uses_per_user ?? 1),
    max_discount: row.max_discount ? Number(row.max_discount) : undefined,
    used_count: Number(row.used_count ?? 0),
    expires_at: row.end_date ? String(row.end_date) : null,
    active: row.active === 1 || row.active === true,
  }
}

export async function getCoupon(code: string): Promise<CouponConfig | null> {
  try {
    const row = await dbQueryFirst<Record<string, unknown>>(
      `SELECT c.*, COUNT(cr.id) as used_count
       FROM coupons c
       LEFT JOIN coupon_redemptions cr ON c.code = cr.coupon_code
       WHERE c.code = ? AND c.active = 1
       GROUP BY c.code`,
      [code.toUpperCase()]
    )
    if (!row) return null
    return mapCouponRow(row)
  } catch (e) {
    console.error('D1 getCoupon error:', e)
    return null
  }
}

export async function countCouponUsage(code: string): Promise<number> {
  try {
    const row = await dbQueryFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ?',
      [code.toUpperCase()]
    )
    return row?.count ?? 0
  } catch (e) {
    console.error('D1 countCouponUsage error:', e)
    return 0
  }
}

export async function countCouponUsageByUser(code: string, lineUserId: string): Promise<number> {
  try {
    const row = await dbQueryFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ? AND line_user_id = ?',
      [code.toUpperCase(), lineUserId]
    )
    return row?.count ?? 0
  } catch (e) {
    console.error('D1 countCouponUsageByUser error:', e)
    return 0
  }
}

export async function appendCouponUsage(code: string, lineUserId: string, orderNumber: string): Promise<void> {
  try {
    await dbRun(
      'INSERT INTO coupon_redemptions (coupon_code, line_user_id, order_number) VALUES (?, ?, ?)',
      [code.toUpperCase(), lineUserId, orderNumber]
    )
  } catch (e) {
    console.error('D1 appendCouponUsage error:', e)
    throw e
  }
}

// ── Orders ─────────────────────────────────────────────────────────────────

export interface OrderRecord {
  orderNumber: string
  restaurantSlug: string
  lineUserId: string
  buildingId: string
  deliveryDate: string
  status: string
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  couponCode: string
  customerName: string
  company: string
  phone: string
  specialNote: string
  createdAt: string
}

export interface OrderItemRecord {
  menuItemId: string
  nameZh: string
  qty: number
  unitPrice: number
  category: string
}

export async function createOrder(
  order: OrderRecord,
  items: OrderItemRecord[]
): Promise<void> {
  const stmts = [
    {
      sql: `INSERT INTO orders (
        order_number, restaurant_slug, line_user_id, building_id, delivery_date,
        status, subtotal, discount, delivery_fee, total, coupon_code,
        customer_name, company, phone, special_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        order.orderNumber, order.restaurantSlug, order.lineUserId, order.buildingId, order.deliveryDate,
        order.status, order.subtotal, order.discount, order.deliveryFee, order.total, order.couponCode || '',
        order.customerName || '', order.company || '', order.phone || '', order.specialNote || '',
        order.createdAt, order.createdAt,
      ],
    },
    ...items.map((item) => ({
      sql: 'INSERT INTO order_items (order_number, menu_item_id, name_zh, qty, unit_price, category) VALUES (?, ?, ?, ?, ?, ?)',
      params: [order.orderNumber, item.menuItemId, item.nameZh, item.qty, item.unitPrice, item.category],
    })),
  ]
  await dbBatch(stmts)
}

export async function updateOrderStatus(orderNumber: string, status: string): Promise<void> {
  await dbRun(
    'UPDATE orders SET status = ?, updated_at = ? WHERE order_number = ?',
    [status, new Date().toISOString(), orderNumber]
  )
}

export async function readOrdersByUser(lineUserId: string): Promise<OrderRecord[]> {
  const res = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM orders WHERE line_user_id = ? ORDER BY created_at DESC`,
    [lineUserId]
  )
  return res.results.map((row) => ({
    orderNumber: String(row.order_number),
    restaurantSlug: String(row.restaurant_slug),
    lineUserId: String(row.line_user_id),
    buildingId: String(row.building_id),
    deliveryDate: String(row.delivery_date),
    status: String(row.status),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    couponCode: String(row.coupon_code),
    customerName: String(row.customer_name),
    company: String(row.company),
    phone: String(row.phone),
    specialNote: String(row.special_note),
    createdAt: String(row.created_at),
  }))
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
  const row = await dbQueryFirst<Record<string, unknown>>(
    'SELECT * FROM orders WHERE order_number = ?',
    [orderNumber]
  )
  if (!row) return null
  return {
    orderNumber: String(row.order_number),
    restaurantSlug: String(row.restaurant_slug),
    lineUserId: String(row.line_user_id),
    buildingId: String(row.building_id),
    deliveryDate: String(row.delivery_date),
    status: String(row.status),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    couponCode: String(row.coupon_code),
    customerName: String(row.customer_name),
    company: String(row.company),
    phone: String(row.phone),
    specialNote: String(row.special_note),
    createdAt: String(row.created_at),
  }
}

export async function getOrderItems(orderNumber: string): Promise<OrderItemRecord[]> {
  const res = await dbQuery<Record<string, unknown>>(
    'SELECT * FROM order_items WHERE order_number = ?',
    [orderNumber]
  )
  return res.results.map((row) => ({
    menuItemId: String(row.menu_item_id),
    nameZh: String(row.name_zh),
    qty: Number(row.qty),
    unitPrice: Number(row.unit_price),
    category: String(row.category),
  }))
}
