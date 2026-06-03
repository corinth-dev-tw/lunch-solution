'use client'

import { useState } from 'react'
import { Trash2, Tag, FileText } from 'lucide-react'
import { CartItem } from '@/types'
import { cn } from '@/lib/utils'

interface OrderCartProps {
  cart: CartItem[]
  deliveryFee: number
  onUpdateCart: (cart: CartItem[]) => void
  onSubmit: (couponCode: string, note: string) => void
  submitting: boolean
  isLoggedIn: boolean
  onLoginRequired: () => void
}

export default function OrderCart({
  cart,
  deliveryFee,
  onUpdateCart,
  onSubmit,
  submitting,
  isLoggedIn,
  onLoginRequired,
}: OrderCartProps) {
  const [couponCode, setCouponCode] = useState('')
  const [note, setNote] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)

  const subtotal = cart.reduce((sum, item) => sum + item.menu_item.price * item.quantity, 0)
  const total = subtotal - couponDiscount + deliveryFee

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponError('')
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}&subtotal=${subtotal}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCouponDiscount(data.discount)
      setCouponApplied(true)
    } catch (e: unknown) {
      setCouponError(e instanceof Error ? e.message : '優惠券無效')
      setCouponDiscount(0)
      setCouponApplied(false)
    }
  }

  function removeItem(itemId: string) {
    onUpdateCart(cart.filter((c) => c.menu_item.id !== itemId))
  }

  if (cart.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400">
        <p>尚未選取任何餐點</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 className="text-gray-800 font-bold text-base">訂購清單</h3>

      {/* Items */}
      <div className="space-y-2">
        {cart.map((item) => (
          <div key={item.menu_item.id} className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 text-sm truncate">{item.menu_item.name_zh}</p>
              <p className="text-gray-500 text-xs">x{item.quantity} × NT${item.menu_item.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-800 text-sm font-medium">
                NT${item.menu_item.price * item.quantity}
              </span>
              <button
                onClick={() => removeItem(item.menu_item.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div>
        <label className="text-gray-500 text-xs mb-1.5 flex items-center gap-1">
          <Tag size={11} /> 優惠券
        </label>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(false); setCouponDiscount(0) }}
            placeholder="輸入優惠碼"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={applyCoupon}
            disabled={couponApplied}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              couponApplied
                ? 'bg-amber-50 text-amber-600 border border-amber-400'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            )}
          >
            {couponApplied ? '已套用' : '套用'}
          </button>
        </div>
        {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
        {couponApplied && <p className="text-green-600 text-xs mt-1">省下 NT${couponDiscount}</p>}
      </div>

      {/* Note */}
      <div>
        <label className="text-gray-500 text-xs mb-1.5 flex items-center gap-1">
          <FileText size={11} /> 備註
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="過敏原、特殊需求..."
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-amber-400 resize-none"
        />
      </div>

      {/* Totals */}
      <div className="space-y-1.5 pt-2 border-t border-gray-100">
        <div className="flex justify-between text-sm text-gray-500">
          <span>小計</span><span>NT${subtotal}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>折扣</span><span>- NT${couponDiscount}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>外送費</span><span>NT${deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-800 font-bold text-base pt-1">
          <span>總計</span><span>NT${total}</span>
        </div>
      </div>

      <button
        onClick={() => isLoggedIn ? onSubmit(couponCode, note) : onLoginRequired()}
        disabled={submitting}
        className={cn(
          'w-full py-3 rounded-xl font-bold text-sm transition-all',
          submitting
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/25 hover:scale-[1.02]'
        )}
      >
        {submitting ? '處理中...' : isLoggedIn ? '確認訂購' : '登入後訂購'}
      </button>
    </div>
  )
}
