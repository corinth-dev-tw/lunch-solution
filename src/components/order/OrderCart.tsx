'use client'

import { useState, useEffect } from 'react'
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

  // Clear any applied coupon when cart changes so stale discounts can't persist
  useEffect(() => {
    if (couponApplied) {
      setCouponApplied(false)
      setCouponDiscount(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart])

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
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white/40">
        <p>尚未選取任何餐點</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-bold text-base">訂購清單</h3>

      {/* Items */}
      <div className="space-y-2">
        {cart.map((item) => (
          <div key={item.menu_item.id} className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{item.menu_item.name_zh}</p>
              <p className="text-white/50 text-xs">x{item.quantity} × NT${item.menu_item.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">
                NT${item.menu_item.price * item.quantity}
              </span>
              <button
                onClick={() => removeItem(item.menu_item.id)}
                className="text-white/30 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div>
        <label className="text-white/60 text-xs mb-1.5 flex items-center gap-1">
          <Tag size={11} /> 優惠券
        </label>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(false); setCouponDiscount(0) }}
            placeholder="輸入優惠碼"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-green-400/50"
          />
          <button
            onClick={applyCoupon}
            disabled={couponApplied}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              couponApplied
                ? 'bg-green-500/20 text-green-400 border border-green-400/30'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            )}
          >
            {couponApplied ? '已套用' : '套用'}
          </button>
        </div>
        {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
        {couponApplied && <p className="text-green-400 text-xs mt-1">省下 NT${couponDiscount}</p>}
      </div>

      {/* Note */}
      <div>
        <label className="text-white/60 text-xs mb-1.5 flex items-center gap-1">
          <FileText size={11} /> 備註
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="過敏原、特殊需求..."
          rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-green-400/50 resize-none"
        />
      </div>

      {/* Totals */}
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="flex justify-between text-sm text-white/60">
          <span>小計</span><span>NT${subtotal}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>折扣</span><span>- NT${couponDiscount}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm text-white/60">
            <span>外送費</span><span>NT${deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between text-white font-bold text-base pt-1">
          <span>總計</span><span>NT${total}</span>
        </div>
      </div>

      <button
        onClick={() => isLoggedIn ? onSubmit(couponCode, note) : onLoginRequired()}
        disabled={submitting}
        className={cn(
          'w-full py-3 rounded-xl font-bold text-sm transition-all',
          submitting
            ? 'bg-white/10 text-white/40 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25 hover:scale-[1.02]'
        )}
      >
        {submitting ? '處理中...' : isLoggedIn ? '確認訂購' : '登入後訂購'}
      </button>
    </div>
  )
}
