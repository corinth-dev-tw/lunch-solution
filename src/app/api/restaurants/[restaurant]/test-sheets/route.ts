import { NextRequest, NextResponse } from 'next/server'
import { writeOrder, isSheetsConfigured } from '@/lib/google/sheets-edge'
import { getRestaurantConfig } from '@/lib/google/registry'
import { format, addDays } from 'date-fns'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurant: string }> }
) {
  const { restaurant } = await params

  if (!isSheetsConfigured()) {
    return NextResponse.json({
      configured: false,
      message: '主帳號 Google Sheets 未設定（master sheet credentials missing）',
    })
  }

  const config = await getRestaurantConfig(restaurant)
  if (!config) {
    return NextResponse.json({ error: `找不到餐廳「${restaurant}」` }, { status: 404 })
  }
  if (!config.spreadsheet_id) {
    return NextResponse.json({
      configured: true,
      restaurantFound: true,
      sheetsReady: false,
      message: `${config.name_zh} 的 spreadsheet_id 尚未填入 Master Sheet 的 Restaurants 分頁`,
    })
  }

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  try {
    await writeOrder(config.spreadsheet_id, {
      orderNumber: `TEST-${Date.now()}`,
      deliveryDate: tomorrow,
      locationName: '台北101辦公大樓',
      customerName: '測試用戶',
      company: '測試公司',
      phone: '0912-345-678',
      lineUserId: 'U_test',
      bentoItems: '測試便當×1',
      bentoQty: 1,
      drinkItems: '',
      subtotal: 200,
      couponCode: '',
      discount: 0,
      total: 200,
      note: '這是測試訂單，可以刪除',
    })
    return NextResponse.json({
      configured: true,
      restaurantFound: true,
      sheetsReady: true,
      restaurant: config.name_zh,
      spreadsheetId: config.spreadsheet_id,
      message: `成功寫入 ${config.name_zh} 的 Google Sheet！請查看 ${tomorrow} 分頁`,
    })
  } catch (e) {
    console.error(`[test-sheets] write error for ${restaurant}:`, e)
    return NextResponse.json({
      configured: true,
      restaurantFound: true,
      sheetsReady: false,
      error: 'Google Sheets write failed',
      hint: '請確認已將 Service Account Email 加入該餐廳 Sheet 的「共用」編輯權限',
    }, { status: 500 })
  }
}
