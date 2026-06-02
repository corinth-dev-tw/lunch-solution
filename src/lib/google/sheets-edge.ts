/**
 * Edge-compatible Google Sheets client.
 * Uses Web Crypto API for JWT signing — works in Cloudflare Workers, Node.js, and browsers.
 * Replaces googleapis (which uses Node.js internals unavailable in Workers).
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ── JWT + token helpers ────────────────────────────────────────────────────────

function base64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function encodeBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str))
}

async function signRS256(payload: string, pemKey: string): Promise<string> {
  const pem = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payload))
  return base64url(new Uint8Array(sig))
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const scope = 'https://www.googleapis.com/auth/spreadsheets'

  const now = Math.floor(Date.now() / 1000)
  const header = encodeBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = encodeBase64url(JSON.stringify({
    iss: email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }))
  const sigInput = `${header}.${claims}`
  const signature = await signRS256(sigInput, key)
  const jwt = `${sigInput}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json() as { access_token: string }
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function sheetsRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${SHEETS_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API ${res.status}: ${err}`)
  }
  return res.json()
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export function isSheetsConfigured(): boolean {
  return (
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL !== 'your_service_account@project.iam.gserviceaccount.com' &&
    !!process.env.GOOGLE_SPREADSHEET_ID &&
    process.env.GOOGLE_SPREADSHEET_ID !== 'your_google_spreadsheet_id'
  )
}

const SPREADSHEET_ID = () => process.env.GOOGLE_SPREADSHEET_ID!

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

const DAILY_HEADERS = [
  '訂單編號', '時間', '取餐日期', '取餐地點',
  '姓名', '公司', '電話', 'LINE ID',
  '便當內容', '便當數量', '加購飲品', '小計',
  '優惠碼', '折扣', '應付金額', '備註', '狀態', '推播',
]

export async function ensureDailyTab(dateStr: string): Promise<void> {
  const id = SPREADSHEET_ID()

  // List existing sheets
  const meta = await sheetsRequest(`/${id}?fields=sheets.properties.title,sheets.properties.sheetId`) as {
    sheets: Array<{ properties: { title: string; sheetId: number } }>
  }
  const existing = meta.sheets.map((s) => s.properties.title)
  if (existing.includes(dateStr)) return

  // Create new tab
  await sheetsRequest(`/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: dateStr } } }] }),
  })

  // Write headers
  await sheetsRequest(`/${id}/values/${encodeURIComponent(`${dateStr}!A1:R1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [DAILY_HEADERS] }),
  })

  // Get the new sheet's ID to format it
  const updated = await sheetsRequest(`/${id}?fields=sheets.properties`) as {
    sheets: Array<{ properties: { title: string; sheetId: number } }>
  }
  const sheetId = updated.sheets.find((s) => s.properties.title === dateStr)?.properties.sheetId

  if (sheetId !== undefined) {
    await sheetsRequest(`/${id}:batchUpdate`, {
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
}

export interface SiammoreOrder {
  orderNumber: string
  deliveryDate: string
  locationName: string
  customerName: string
  company: string
  phone: string
  lineUserId: string
  bentoItems: string
  bentoQty: number
  drinkItems: string
  subtotal: number
  couponCode: string
  discount: number
  total: number
  note: string
}

export async function writeSiammoreOrder(order: SiammoreOrder): Promise<void> {
  await ensureDailyTab(order.deliveryDate)

  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
  const row = [
    order.orderNumber, now, order.deliveryDate, order.locationName,
    order.customerName, order.company, order.phone, order.lineUserId,
    order.bentoItems, order.bentoQty, order.drinkItems || '',
    order.subtotal, order.couponCode || '', order.discount || 0, order.total,
    order.note || '', '⚪ 待確認', '',
  ]

  await sheetsRequest(
    `/${SPREADSHEET_ID()}/values/${encodeURIComponent(`${order.deliveryDate}!A:R`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) }
  )
}

export async function updateOrderStatus(dateStr: string, orderNumber: string, status: string): Promise<void> {
  const id = SPREADSHEET_ID()
  const res = await sheetsRequest(
    `/${id}/values/${encodeURIComponent(`${dateStr}!A:A`)}?majorDimension=ROWS`
  ) as { values?: string[][] }
  const rows = res.values ?? []
  const rowIndex = rows.findIndex((r) => r[0] === orderNumber)
  if (rowIndex < 1) return

  await sheetsRequest(
    `/${id}/values/${encodeURIComponent(`${dateStr}!Q${rowIndex + 1}`)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [[status]] }) }
  )
}
