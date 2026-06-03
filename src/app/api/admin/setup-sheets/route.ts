/**
 * One-time master sheet setup endpoint.
 * Protected by RESTAURANT_API_KEY header.
 *
 * Idempotent — safe to call multiple times.
 * Creates missing tabs, adds missing header columns, fills seed data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, isSheetsConfigured } from '@/lib/google/sheets-edge'
import { XINYI_LOCATIONS } from '@/lib/constants/locations'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const MASTER_ID = () => process.env.GOOGLE_SPREADSHEET_ID!

// ── Low-level helpers ────────────────────────────────────────────────────────

async function api(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getSheetMeta(): Promise<{ sheetId: number; title: string }[]> {
  const data = await api(`/${MASTER_ID()}?fields=sheets.properties`) as {
    sheets: Array<{ properties: { title: string; sheetId: number } }>
  }
  return data.sheets.map((s) => ({ sheetId: s.properties.sheetId, title: s.properties.title }))
}

async function createTab(title: string): Promise<number> {
  const data = await api(`/${MASTER_ID()}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  }) as { replies: Array<{ addSheet?: { properties: { sheetId: number } } }> }
  return data.replies[0].addSheet!.properties.sheetId
}

async function readRow1(tab: string): Promise<string[]> {
  try {
    const data = await api(
      `/${MASTER_ID()}/values/${encodeURIComponent(`${tab}!A1:Z1`)}?majorDimension=ROWS`
    ) as { values?: string[][] }
    return data.values?.[0] ?? []
  } catch {
    return []
  }
}

async function writeRange(range: string, values: unknown[][]): Promise<void> {
  await api(
    `/${MASTER_ID()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values }) }
  )
}

async function appendRows(range: string, values: unknown[][]): Promise<void> {
  await api(
    `/${MASTER_ID()}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values }) }
  )
}

async function freezeAndBoldHeader(sheetId: number): Promise<void> {
  await api(`/${MASTER_ID()}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.96, green: 0.76, blue: 0.26 },
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    }),
  })
}

// ── Tab definitions ──────────────────────────────────────────────────────────

const RESTAURANTS_HEADERS = [
  'slug', 'name_zh', 'address', 'phone',
  'banner_path', 'logo_path', 'spreadsheet_id', 'active',
  'tagline', 'cutoff_hour', 'delivery_times',
]

const MENU_ITEMS_HEADERS = [
  'restaurant_slug', 'id', 'name_zh', 'description',
  'price', 'category', 'image_path', 'available', 'sort_order',
]

const LOCATIONS_HEADERS = [
  'id', 'name_zh', 'name', 'address', 'lat', 'lng', 'active',
]

const LOCATIONS_SEED = XINYI_LOCATIONS.map((l) => [
  l.id, l.name_zh, l.name, l.address,
  l.coordinates[1], l.coordinates[0], 'TRUE',
])

const RESTAURANTS_SEED = [[
  'siammore', '饗泰多 松高店', '台北市信義區松高路16號3樓', '02-27221728',
  '/siammore/banners/banner-siammore.jpg', '/siammore/logo/siammore logo.png',
  '', 'TRUE', '雙主菜 + 三配菜 · 超有料餐盒', '21', '11:30,12:00,12:30',
]]

const MENU_ITEMS_SEED = [
  ['siammore', 'qtan',     'Q彈好咖餐盒',  '脆口炸雞腿 + 雙主菜 + 三配菜，Q彈鮮嫩超滿足', 200, 'bento', '/siammore/products/qtan-bento.jpg',  'TRUE', 1],
  ['siammore', 'basil',    '開胃扒飯餐盒', '香辣打拋豬 + 雙主菜 + 三配菜，開胃夠味泰式風', 200, 'bento', '/siammore/products/basil-bento.jpg', 'TRUE', 2],
  ['siammore', 'kacha',    '咔滋爆爽餐盒', '咔滋嫩牛 + 雙主菜 + 三配菜，爽脆口感每口過癮',   200, 'bento', '/siammore/products/kacha-bento.jpg', 'TRUE', 3],
  ['siammore', 'milk-tea', '泰式奶茶',     '濃郁奶香，泰式經典',                           60,  'drink', '/siammore/products/thai-milk-tea.jpg', 'TRUE', 4],
  ['siammore', 'lemon',    '泰式檸檬飲',   '清爽酸甜，消暑解膩',                           50,  'drink', '/siammore/products/lemon-drink.jpg',   'TRUE', 5],
]

// ── Main setup logic ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth guard
  if (req.headers.get('x-restaurant-key') !== process.env.RESTAURANT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSheetsConfigured()) {
    return NextResponse.json({ error: 'Google Sheets not configured (missing env vars)' }, { status: 503 })
  }

  const log: string[] = []
  const errors: string[] = []

  async function run(label: string, fn: () => Promise<void>) {
    try {
      await fn()
      log.push(`✅ ${label}`)
    } catch (e) {
      errors.push(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const sheets = await getSheetMeta()
  const titles = sheets.map((s) => s.title)

  // ── Locations tab ──────────────────────────────────────────────────────────
  const hasLocations = titles.includes('Locations')
  let locationsSheetId: number | undefined

  if (!hasLocations) {
    await run('Create Locations tab', async () => {
      locationsSheetId = await createTab('Locations')
    })
  } else {
    locationsSheetId = sheets.find((s) => s.title === 'Locations')?.sheetId
    log.push('ℹ️ Locations tab already exists')
  }

  await run('Write Locations headers', async () => {
    await writeRange('Locations!A1:G1', [LOCATIONS_HEADERS])
  })

  if (!hasLocations) {
    await run('Seed Locations data (7 Xinyi locations)', async () => {
      await appendRows('Locations!A:G', LOCATIONS_SEED)
    })
  } else {
    // Check if data already exists
    const existingData = await api(
      `/${MASTER_ID()}/values/${encodeURIComponent('Locations!A2:A')}?majorDimension=ROWS`
    ) as { values?: string[][] }
    if (!existingData.values?.length) {
      await run('Seed Locations data (7 Xinyi locations)', async () => {
        await appendRows('Locations!A:G', LOCATIONS_SEED)
      })
    } else {
      log.push(`ℹ️ Locations already has ${existingData.values.length} rows — not overwriting`)
    }
  }

  if (locationsSheetId !== undefined) {
    await run('Format Locations header', async () => {
      await freezeAndBoldHeader(locationsSheetId!)
    })
  }

  // ── Restaurants tab ────────────────────────────────────────────────────────
  const hasRestaurants = titles.includes('Restaurants')
  let restaurantsSheetId: number | undefined

  if (!hasRestaurants) {
    await run('Create Restaurants tab', async () => {
      restaurantsSheetId = await createTab('Restaurants')
    })
    await run('Write Restaurants headers (A:K)', async () => {
      await writeRange('Restaurants!A1:K1', [RESTAURANTS_HEADERS])
    })
    await run('Seed Restaurants data (siammore)', async () => {
      await appendRows('Restaurants!A:K', RESTAURANTS_SEED)
    })
  } else {
    restaurantsSheetId = sheets.find((s) => s.title === 'Restaurants')?.sheetId
    log.push('ℹ️ Restaurants tab already exists')

    // Ensure delivery_times column (K) header exists
    const headers = await readRow1('Restaurants')
    if (!headers.includes('delivery_times')) {
      const col = headers.length  // 0-indexed length = next column index
      const colLetter = String.fromCharCode(65 + col)  // A=65
      await run(`Add delivery_times header at column ${colLetter}`, async () => {
        await writeRange(`Restaurants!${colLetter}1`, [['delivery_times']])
      })
    } else {
      log.push('ℹ️ Restaurants delivery_times column already present')
    }
  }

  if (restaurantsSheetId !== undefined) {
    await run('Format Restaurants header', async () => {
      await freezeAndBoldHeader(restaurantsSheetId!)
    })
  }

  // ── MenuItems tab ──────────────────────────────────────────────────────────
  const hasMenuItems = titles.includes('MenuItems')
  let menuSheetId: number | undefined

  if (!hasMenuItems) {
    await run('Create MenuItems tab', async () => {
      menuSheetId = await createTab('MenuItems')
    })
    await run('Write MenuItems headers', async () => {
      await writeRange('MenuItems!A1:I1', [MENU_ITEMS_HEADERS])
    })
    await run('Seed MenuItems data (siammore 5 items)', async () => {
      await appendRows('MenuItems!A:I', MENU_ITEMS_SEED)
    })
  } else {
    menuSheetId = sheets.find((s) => s.title === 'MenuItems')?.sheetId
    log.push('ℹ️ MenuItems tab already exists')

    const menuData = await api(
      `/${MASTER_ID()}/values/${encodeURIComponent('MenuItems!A2:A')}?majorDimension=ROWS`
    ) as { values?: string[][] }
    if (!menuData.values?.length) {
      await run('Write MenuItems headers', () => writeRange('MenuItems!A1:I1', [MENU_ITEMS_HEADERS]))
      await run('Seed MenuItems data (siammore 5 items)', () => appendRows('MenuItems!A:I', MENU_ITEMS_SEED))
    } else {
      log.push(`ℹ️ MenuItems already has ${menuData.values.length} rows — not overwriting`)
    }
  }

  if (menuSheetId !== undefined) {
    await run('Format MenuItems header', async () => {
      await freezeAndBoldHeader(menuSheetId!)
    })
  }

  return NextResponse.json({
    ok: errors.length === 0,
    spreadsheetId: MASTER_ID(),
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MASTER_ID()}/edit`,
    log,
    errors,
  })
}
