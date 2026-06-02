/**
 * Master sheet registry.
 * Reads restaurant configs and menus from the master Google Sheet.
 * Falls back to DEV_CONFIG when Sheets is not yet configured.
 */

import { isSheetsConfigured } from './sheets-edge'

export interface RestaurantConfig {
  slug: string
  name_zh: string
  address: string
  phone: string
  banner_path: string
  logo_path: string
  spreadsheet_id: string  // the restaurant's OWN sheet for orders
  active: boolean
  tagline: string
  cutoff_hour: number     // orders cut off at this hour the day before (e.g. 21 = 9pm)
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

// ── Dev fallback (used when Sheets not configured) ─────────────────────────
export const DEV_RESTAURANTS: RestaurantConfig[] = [
  {
    slug: 'siammore',
    name_zh: '饗泰多 松高店',
    address: '台北市信義區松高路16號3樓',
    phone: '02-27221728',
    banner_path: '/siammore/banners/banner-siammore.jpg',
    logo_path: '/siammore/logo/siammore logo.png',
    spreadsheet_id: '',   // fill in after creating the restaurant's sheet
    active: true,
    tagline: '雙主菜 + 三配菜 · 超有料餐盒',
    cutoff_hour: 21,
  },
]

export const DEV_MENU: MenuItemConfig[] = [
  { id: 'qtan',     restaurant_slug: 'siammore', name_zh: 'Q彈好咖餐盒',  description: '脆口炸雞腿 + 雙主菜 + 三配菜，Q彈鮮嫩超滿足', price: 200, category: 'bento', image_path: '/siammore/products/qtan-bento.jpg',  available: true, sort_order: 1 },
  { id: 'basil',    restaurant_slug: 'siammore', name_zh: '開胃扒飯餐盒', description: '香辣打拋豬 + 雙主菜 + 三配菜，開胃夠味泰式風', price: 200, category: 'bento', image_path: '/siammore/products/basil-bento.jpg', available: true, sort_order: 2 },
  { id: 'kacha',    restaurant_slug: 'siammore', name_zh: '咔滋爆爽餐盒', description: '咔滋嫩牛 + 雙主菜 + 三配菜，爽脆口感每口過癮',   price: 200, category: 'bento', image_path: '/siammore/products/kacha-bento.jpg', available: true, sort_order: 3 },
  { id: 'milk-tea', restaurant_slug: 'siammore', name_zh: '泰式奶茶',     description: '濃郁奶香，泰式經典',                           price: 60,  category: 'drink', image_path: '/siammore/products/thai-milk-tea.jpg', available: true, sort_order: 4 },
  { id: 'lemon',    restaurant_slug: 'siammore', name_zh: '泰式檸檬飲',   description: '清爽酸甜，消暑解膩',                           price: 50,  category: 'drink', image_path: '/siammore/products/lemon-drink.jpg',   available: true, sort_order: 5 },
]

// ── Google Sheets reader ───────────────────────────────────────────────────
const MASTER_ID = () => process.env.GOOGLE_SPREADSHEET_ID!
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function getAccessToken(): Promise<string> {
  // Lazy import to keep tree-shaking clean
  const { getAccessToken: _get } = await import('./sheets-edge')
  return _get()
}

async function readRange(range: string): Promise<string[][]> {
  const token = await getAccessToken()
  const url = `${BASE}/${MASTER_ID()}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Registry read failed ${res.status}: ${await res.text()}`)
  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}

function col(row: string[], i: number, fallback = ''): string {
  return (row[i] ?? fallback).trim()
}

export async function getRestaurantConfig(slug: string): Promise<RestaurantConfig | null> {
  if (!isSheetsConfigured()) {
    return DEV_RESTAURANTS.find((r) => r.slug === slug) ?? null
  }
  try {
    // Row format: slug | name_zh | address | phone | banner_path | logo_path | spreadsheet_id | active | tagline | cutoff_hour
    const rows = await readRange('Restaurants!A2:J200')
    const row = rows.find((r) => col(r, 0) === slug && col(r, 7).toUpperCase() !== 'FALSE')
    if (!row) return null
    return {
      slug:            col(row, 0),
      name_zh:         col(row, 1),
      address:         col(row, 2),
      phone:           col(row, 3),
      banner_path:     col(row, 4),
      logo_path:       col(row, 5),
      spreadsheet_id:  col(row, 6),
      active:          col(row, 7).toUpperCase() !== 'FALSE',
      tagline:         col(row, 8),
      cutoff_hour:     parseInt(col(row, 9, '21')),
    }
  } catch (e) {
    console.error('Registry getRestaurantConfig error:', e)
    return DEV_RESTAURANTS.find((r) => r.slug === slug) ?? null
  }
}

export async function getAllRestaurants(): Promise<RestaurantConfig[]> {
  if (!isSheetsConfigured()) return DEV_RESTAURANTS.filter((r) => r.active)
  try {
    const rows = await readRange('Restaurants!A2:J200')
    return rows
      .filter((r) => r.length > 0 && col(r, 7).toUpperCase() !== 'FALSE')
      .map((row) => ({
        slug:            col(row, 0),
        name_zh:         col(row, 1),
        address:         col(row, 2),
        phone:           col(row, 3),
        banner_path:     col(row, 4),
        logo_path:       col(row, 5),
        spreadsheet_id:  col(row, 6),
        active:          true,
        tagline:         col(row, 8),
        cutoff_hour:     parseInt(col(row, 9, '21')),
      }))
  } catch (e) {
    console.error('Registry getAllRestaurants error:', e)
    return DEV_RESTAURANTS.filter((r) => r.active)
  }
}

export async function getMenuItems(slug: string): Promise<MenuItemConfig[]> {
  if (!isSheetsConfigured()) {
    return DEV_MENU.filter((m) => m.restaurant_slug === slug && m.available)
  }
  try {
    // Row format: restaurant_slug | id | name_zh | description | price | category | image_path | available | sort_order
    const rows = await readRange('MenuItems!A2:I500')
    return rows
      .filter((r) => col(r, 0) === slug && col(r, 7).toUpperCase() !== 'FALSE')
      .map((row) => ({
        restaurant_slug: col(row, 0),
        id:              col(row, 1),
        name_zh:         col(row, 2),
        description:     col(row, 3),
        price:           parseInt(col(row, 4, '0')),
        category:        col(row, 5, 'bento') as MenuItemConfig['category'],
        image_path:      col(row, 6),
        available:       col(row, 7).toUpperCase() !== 'FALSE',
        sort_order:      parseInt(col(row, 8, '99')),
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  } catch (e) {
    console.error('Registry getMenuItems error:', e)
    return DEV_MENU.filter((m) => m.restaurant_slug === slug && m.available)
  }
}
