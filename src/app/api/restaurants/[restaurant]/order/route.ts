import { NextRequest, NextResponse } from 'next/server'
import { writeOrder, isSheetsConfigured, OrderRow } from '@/lib/google/sheets-edge'
import { getRestaurantConfig } from '@/lib/google/registry'
import { format } from 'date-fns'

function generateOrderNumber(slug: string): string {
  const prefix = slug.substring(0, 3).toUpperCase()
  const datePart = format(new Date(), 'yyyyMMdd')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${datePart}-${rand}`
}

interface OrderBody {
  deliveryDate: string
  locationName: string
  customerName: string
  company?: string
  phone: string
  lineUserId?: string
  items: Array<{ name: string; qty: number; price: number; category: 'bento' | 'drink' | 'side' }>
  couponCode?: string
  discount?: number
  note?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restaurant: string }> }
) {
  const { restaurant } = await params
  const body: OrderBody = await req.json()
  const { deliveryDate, locationName, customerName, phone, items, couponCode, note } = body

  if (!deliveryDate || !locationName || !customerName || !phone) {
    return NextResponse.json({ error: '請填寫必要資訊' }, { status: 400 })
  }
  if (!items?.length) {
    return NextResponse.json({ error: '請選擇餐點' }, { status: 400 })
  }

  const bentos = items.filter((i) => i.category === 'bento' || i.category === 'side')
  const drinks = items.filter((i) => i.category === 'drink')
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = body.discount ?? 0
  const total = subtotal - discount
  const orderNumber = generateOrderNumber(restaurant)

  const orderRow: OrderRow = {
    orderNumber,
    deliveryDate,
    locationName,
    customerName,
    company: body.company ?? '',
    phone,
    lineUserId: body.lineUserId ?? '',
    bentoItems: bentos.map((i) => `${i.name}×${i.qty}`).join(', '),
    bentoQty: bentos.reduce((s, i) => s + i.qty, 0),
    drinkItems: drinks.map((i) => `${i.name}×${i.qty}`).join(', '),
    subtotal,
    couponCode: couponCode ?? '',
    discount,
    total,
    note: note ?? '',
  }

  if (!isSheetsConfigured()) {
    return NextResponse.json({ orderNumber, total, sheetsWritten: false, devMode: true }, { status: 201 })
  }

  // Get restaurant's own spreadsheet_id from registry
  const config = await getRestaurantConfig(restaurant)
  if (!config) {
    return NextResponse.json({ error: '餐廳不存在' }, { status: 404 })
  }
  if (!config.spreadsheet_id) {
    return NextResponse.json({ error: '餐廳 Google Sheet 尚未設定' }, { status: 503 })
  }

  try {
    await writeOrder(config.spreadsheet_id, orderRow)
    return NextResponse.json({ orderNumber, total, sheetsWritten: true }, { status: 201 })
  } catch (e) {
    console.error(`Order write error [${restaurant}]:`, e)
    return NextResponse.json({ error: 'Google Sheets 寫入失敗', detail: String(e) }, { status: 500 })
  }
}
