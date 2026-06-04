import { NextRequest, NextResponse } from 'next/server'
import { getCoupon, countCouponUsage } from '@/lib/google/registry'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const subtotal = parseInt(searchParams.get('subtotal') ?? '0')

  if (!code) return NextResponse.json({ error: '請輸入優惠碼' }, { status: 400 })

  const coupon = await getCoupon(code)
  if (!coupon || !coupon.active) {
    return NextResponse.json({ error: '優惠券不存在' }, { status: 404 })
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: '優惠券已過期' }, { status: 400 })
  }

  const usedCount = await countCouponUsage(code)
  if (usedCount >= coupon.max_uses) {
    return NextResponse.json({ error: '優惠券已使用完畢' }, { status: 400 })
  }

  if (subtotal < coupon.min_order) {
    return NextResponse.json({ error: `最低消費 NT$${coupon.min_order} 才可使用` }, { status: 400 })
  }

  const discount =
    coupon.discount_type === 'fixed'
      ? Math.min(coupon.discount_value, subtotal)
      : Math.floor((subtotal * coupon.discount_value) / 100)

  return NextResponse.json({ discount, couponId: coupon.code })
}
