/**
 * Master sheet registry.
 * Reads restaurant configs, menus, and locations from the master Google Sheet.
 * Falls back to DEV constants when Sheets is not yet configured.
 */

import { isSheetsConfigured } from './sheets-edge'
import { XINYI_LOCATIONS } from '@/lib/constants/locations'

export interface LocationConfig {
  id: string
  name_zh: string
  name: string
  address: string
  lat: number
  lng: number
}

export interface RestaurantConfig {
  slug: string
  name_zh: string
  address: string
  phone: string
  banner_path: string
  logo_path: string
  spreadsheet_id: string  // the restaurant's OWN sheet for orders + menu
  active: boolean
  tagline: string
  cutoff_hour: number       // orders cut off at this hour the day before (e.g. 21 = 9pm)
  delivery_times: string[]  // e.g. ['11:30', '12:00', '12:30']
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

// ── Dev fallbacks ──────────────────────────────────────────────────────────
export const DEV_LOCATIONS: LocationConfig[] = XINYI_LOCATIONS.map((l) => ({
  id: l.id,
  name_zh: l.name_zh,
  name: l.name,
  address: l.address,
  lat: l.coordinates[1],
  lng: l.coordinates[0],
}))

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
    delivery_times: ['11:30', '12:00', '12:30'],
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
  const { getAccessToken: _get } = await import('./sheets-edge')
  return _get()
}

async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const token = await getAccessToken()
  const url = `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Registry read failed ${res.status}: ${await res.text()}`)
  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}

function col(row: string[], i: number, fallback = ''): string {
  return (row[i] ?? fallback).trim()
}

function parseDeliveryTimes(raw: string): string[] {
  if (!raw) return ['11:30', '12:00', '12:30']
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

function rowToRestaurantConfig(row: string[]): RestaurantConfig {
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
    delivery_times:  parseDeliveryTimes(col(row, 10)),
  }
}

// ── Locations ─────────────────────────────────────────────────────────────

export async function getLocations(): Promise<LocationConfig[]> {
  if (!isSheetsConfigured()) return DEV_LOCATIONS
  try {
    // Locations sheet: id | name_zh | name | address | lat | lng | active
    const rows = await readRange(MASTER_ID(), 'Locations!A2:G200')
    const results = rows
      .filter((r) => r.length > 0 && col(r, 6).toUpperCase() !== 'FALSE')
      .map((row) => ({
        id:      col(row, 0),
        name_zh: col(row, 1),
        name:    col(row, 2),
        address: col(row, 3),
        lat:     parseFloat(col(row, 4, '0')),
        lng:     parseFloat(col(row, 5, '0')),
      }))
    return results.length > 0 ? results : DEV_LOCATIONS
  } catch (e) {
    console.error('Registry getLocations error:', e)
    return DEV_LOCATIONS
  }
}

// ── Restaurants ───────────────────────────────────────────────────────────

export async function getRestaurantConfig(slug: string): Promise<RestaurantConfig | null> {
  if (!isSheetsConfigured()) {
    return DEV_RESTAURANTS.find((r) => r.slug === slug) ?? null
  }
  try {
    const rows = await readRange(MASTER_ID(), 'Restaurants!A2:K200')
    const row = rows.find((r) => col(r, 0) === slug && col(r, 7).toUpperCase() !== 'FALSE')
    if (!row) return null
    return rowToRestaurantConfig(row)
  } catch (e) {
    console.error('Registry getRestaurantConfig error:', e)
    return DEV_RESTAURANTS.find((r) => r.slug === slug) ?? null
  }
}

export async function getAllRestaurants(): Promise<RestaurantConfig[]> {
  if (!isSheetsConfigured()) return DEV_RESTAURANTS.filter((r) => r.active)
  try {
    const rows = await readRange(MASTER_ID(), 'Restaurants!A2:K200')
    return rows
      .filter((r) => r.length > 0 && col(r, 7).toUpperCase() !== 'FALSE')
      .map(rowToRestaurantConfig)
  } catch (e) {
    console.error('Registry getAllRestaurants error:', e)
    return DEV_RESTAURANTS.filter((r) => r.active)
  }
}

// ── Menu items ────────────────────────────────────────────────────────────

// Read menu from a restaurant's own spreadsheet (Menu tab)
// Row format: id | name_zh | description | price | category | image_path | available | sort_order
export async function getMenuItemsFromSheet(spreadsheetId: string, slug: string): Promise<MenuItemConfig[] | null> {
  try {
    const rows = await readRange(spreadsheetId, 'Menu!A2:H500')
    if (rows.length === 0) return null
    return rows
      .filter((r) => r.length > 0 && col(r, 6).toUpperCase() !== 'FALSE')
      .map((row) => ({
        restaurant_slug: slug,
        id:              col(row, 0),
        name_zh:         col(row, 1),
        description:     col(row, 2),
        price:           parseInt(col(row, 3, '0')),
        category:        col(row, 4, 'bento') as MenuItemConfig['category'],
        image_path:      col(row, 5),
        available:       true,
        sort_order:      parseInt(col(row, 7, '99')),
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  } catch {
    return null
  }
}

// Read menu from master sheet's MenuItems tab (fallback)
// Row format: restaurant_slug | id | name_zh | description | price | category | image_path | available | sort_order
export async function getMenuItems(slug: string): Promise<MenuItemConfig[]> {
  if (!isSheetsConfigured()) {
    return DEV_MENU.filter((m) => m.restaurant_slug === slug && m.available)
  }
  try {
    const rows = await readRange(MASTER_ID(), 'MenuItems!A2:I500')
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
