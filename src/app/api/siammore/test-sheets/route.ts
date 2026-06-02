
import { NextResponse } from 'next/server'
import { writeSiammoreOrder, isSheetsConfigured } from '@/lib/google/sheets-edge'
import { format, addDays } from 'date-fns'

export async function GET() {
  if (!isSheetsConfigured()) {
    return NextResponse.json({
      configured: false,
      message: 'Google Sheets credentials not set. Fill in GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SPREADSHEET_ID in .env.local (or Cloudflare Pages env vars)',
    })
  }

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  try {
    await writeSiammoreOrder({
      orderNumber: `TEST-${Date.now()}`,
      deliveryDate: tomorrow,
      locationName: '台北101辦公大樓',
      customerName: '測試用戶',
      company: '測試公司',
      phone: '0912-345-678',
      lineUserId: 'U_test',
      bentoItems: 'Q彈好咖餐盒×2, 開胃扒飯餐盒×1',
      bentoQty: 3,
      drinkItems: '泰式奶茶×2',
      subtotal: 720,
      couponCode: '',
      discount: 0,
      total: 720,
      note: '這是測試訂單，可以刪除',
    })
    return NextResponse.json({
      configured: true,
      success: true,
      message: `✅ 成功寫入 Google Sheets！請查看 ${tomorrow} 分頁`,
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    })
  } catch (e) {
    return NextResponse.json({ configured: true, success: false, error: String(e) }, { status: 500 })
  }
}
