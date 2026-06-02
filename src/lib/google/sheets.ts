import { google } from 'googleapis'
import { Order } from '@/types'
import { XINYI_LOCATIONS } from '@/lib/constants/locations'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const SHEET_HEADERS = [
  '訂單編號', '訂單狀態', '取餐地點', '取餐日期',
  '會員名稱', 'LINE ID', '餐廳', '訂購內容',
  '小計', '折扣', '運費', '總計', '優惠券', '備註', '建立時間',
]

// ── Daily-tab headers (used by siammore shop) ──────────────────────────────
const DAILY_HEADERS = [
  '訂單編號', '時間', '取餐日期', '取餐地點',
  '姓名', '公司', '電話', 'LINE ID',
  '便當內容', '便當數量', '加購飲品', '小計',
  '優惠碼', '折扣', '應付金額', '備註', '狀態', '推播',
]

export function isConfigured(): boolean {
  return (
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL !== 'your_service_account@project.iam.gserviceaccount.com' &&
    !!process.env.GOOGLE_SPREADSHEET_ID &&
    process.env.GOOGLE_SPREADSHEET_ID !== 'your_google_spreadsheet_id'
  )
}

// ── Ensure the daily tab exists and has headers ────────────────────────────
export async function ensureDailyTab(dateStr: string): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!

  // Get all sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existing = meta.data.sheets?.map((s) => s.properties?.title) ?? []

  if (!existing.includes(dateStr)) {
    // Create new tab
    const date = new Date(dateStr + 'T12:00:00+08:00')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const tabTitle = `${dateStr} (週${weekDays[date.getDay()]})`
    const actualTitle = dateStr // keep it plain for lookups

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: actualTitle } } }],
      },
    })

    // Write headers and freeze row 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${actualTitle}!A1:R1`,
      valueInputOption: 'RAW',
      requestBody: { values: [DAILY_HEADERS] },
    })

    // Bold + background on header row
    const sheetId = (await sheets.spreadsheets.get({ spreadsheetId }))
      .data.sheets?.find((s) => s.properties?.title === actualTitle)?.properties?.sheetId

    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
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
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
          ],
        },
      })
    }
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
  bentoItems: string   // e.g. "Q彈好咖餐盒×3, 開胃扒飯餐盒×2"
  bentoQty: number
  drinkItems: string
  subtotal: number
  couponCode: string
  discount: number
  total: number
  note: string
}

// ── Write a Siammore order to its daily tab ────────────────────────────────
export async function writeSiammoreOrder(order: SiammoreOrder): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!

  await ensureDailyTab(order.deliveryDate)

  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
  const row = [
    order.orderNumber,
    now,
    order.deliveryDate,
    order.locationName,
    order.customerName,
    order.company,
    order.phone,
    order.lineUserId,
    order.bentoItems,
    order.bentoQty,
    order.drinkItems || '',
    order.subtotal,
    order.couponCode || '',
    order.discount || 0,
    order.total,
    order.note || '',
    '⚪ 待確認',
    '',
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${order.deliveryDate}!A:R`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

// ── Update status of an existing order in its daily tab ───────────────────
export async function updateOrderStatus(
  dateStr: string,
  orderNumber: string,
  status: string
): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${dateStr}!A:A`,
  })
  const rows = res.data.values ?? []
  const rowIndex = rows.findIndex((r) => r[0] === orderNumber)
  if (rowIndex < 1) return

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${dateStr}!Q${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  })
}

// ── Legacy single-sheet functions (kept for existing routes) ──────────────
export async function ensureSheetHeaders(): Promise<void> {
  if (!isConfigured()) return
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
  const range = 'Orders!A1:O1'
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  if (!existing.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range, valueInputOption: 'RAW',
      requestBody: { values: [SHEET_HEADERS] },
    })
  }
}

export async function syncOrderToSheets(
  order: Order,
  memberName: string,
  lineUserId: string,
  restaurantName: string
): Promise<void> {
  if (!isConfigured()) return
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
  const location = XINYI_LOCATIONS.find((l) => l.id === order.location_id)
  const locationName = location ? `${location.name_zh}` : order.location_id
  const itemsSummary = order.items.map((i) => `${i.menu_item_name} x${i.quantity}`).join('; ')
  const row = [
    order.order_number, order.status, locationName, order.delivery_date,
    memberName, lineUserId, restaurantName, itemsSummary,
    order.subtotal, order.discount, order.delivery_fee, order.total,
    order.coupon_code ?? '', order.special_note ?? '',
    new Date(order.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  ]
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Orders!A:A' })
  const rows = existing.data.values ?? []
  const rowIndex = rows.findIndex((r) => r[0] === order.order_number)
  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `Orders!A${rowIndex + 1}:O${rowIndex + 1}`,
      valueInputOption: 'RAW', requestBody: { values: [row] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Orders!A:O', valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] },
    })
  }
}
