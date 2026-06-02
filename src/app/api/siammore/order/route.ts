
import { NextRequest, NextResponse } from 'next/server'
import { writeSiammoreOrder, isSheetsConfigured, SiammoreOrder } from '@/lib/google/sheets-edge'
import { format } from 'date-fns'

function generateOrderNumber(): string {
  const now = new Date()
  const datePart = format(now, 'yyyyMMdd')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `STM-${datePart}-${rand}`
}

export interface OrderRequestBody {
  deliveryDate: string       // YYYY-MM-DD
  locationName: string
  customerName: string
  company?: string
  phone: string
  lineUserId?: string
  items: Array<{ name: string; qty: number; price: number; category: 'bento' | 'drink' }>
  couponCode?: string
  discount?: number
  note?: string
}

export async function POST(req: NextRequest) {
  const body: OrderRequestBody = await req.json()
  const { deliveryDate, locationName, customerName, phone, items, couponCode, note } = body

  if (!deliveryDate || !locationName || !customerName || !phone) {
    return NextResponse.json({ error: '請填寫必要資訊' }, { status: 400 })
  }
  if (!items?.length) {
    return NextResponse.json({ error: '請選擇餐點' }, { status: 400 })
  }

  const bentos = items.filter((i) => i.category === 'bento')
  const drinks = items.filter((i) => i.category === 'drink')
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = body.discount ?? 0
  const total = subtotal - discount

  const bentoText = bentos.map((i) => `${i.name}×${i.qty}`).join(', ')
  const drinkText = drinks.map((i) => `${i.name}×${i.qty}`).join(', ')
  const bentoQty = bentos.reduce((s, i) => s + i.qty, 0)
  const orderNumber = generateOrderNumber()

  const order: SiammoreOrder = {
    orderNumber,
    deliveryDate,
    locationName,
    customerName,
    company: body.company ?? '',
    phone,
    lineUserId: body.lineUserId ?? '',
    bentoItems: bentoText,
    bentoQty,
    drinkItems: drinkText,
    subtotal,
    couponCode: couponCode ?? '',
    discount,
    total,
    note: note ?? '',
  }

  if (!isSheetsConfigured()) {
    // Return mock success when Sheets not configured (dev mode)
    return NextResponse.json({
      orderNumber,
      total,
      sheetsWritten: false,
      devMode: true,
    }, { status: 201 })
  }

  try {
    await writeSiammoreOrder(order)
    return NextResponse.json({ orderNumber, total, sheetsWritten: true }, { status: 201 })
  } catch (e) {
    console.error('Sheets write error:', e)
    return NextResponse.json(
      { error: 'Google Sheets 寫入失敗', detail: String(e) },
      { status: 500 }
    )
  }
}
