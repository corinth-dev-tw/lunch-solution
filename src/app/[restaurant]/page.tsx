'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { format, addDays, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, CheckCircle, ShoppingBag, AlertCircle, ClipboardList, Calendar, Gift, User, MapPin, ChefHat, Salad, CupSoda, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RestaurantConfig, MenuItemConfig } from '@/lib/google/registry'
import LoginButton from '@/components/line/LoginButton'

const LOCATIONS = [
  '台北101辦公大樓',
  '台北交易廣場',
  '世界貿易中心',
  '信義區松高路16號3樓（自取）',
]

import { getAvailableDates } from '@/lib/utils'



type Step = 'order' | 'checkout' | 'success'

export default function RestaurantPage() {
  const { restaurant } = useParams<{ restaurant: string }>()
  const weekdays = useMemo(getAvailableDates, [])

  const [config, setConfig] = useState<RestaurantConfig | null>(null)
  const [menu, setMenu] = useState<MenuItemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep] = useState<Step>('order')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0])
  const [dateOpen, setDateOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [note, setNote] = useState('')

  // Session
  const [session, setSession] = useState<{ displayName: string; pictureUrl?: string } | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Checkout fields
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    orderNumber: string; total: number
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [configRes, sessionRes] = await Promise.all([
        fetch(`/api/restaurants/${restaurant}/config`),
        fetch('/api/auth/session'),
      ])
      const data = configRes.ok ? await configRes.json() : {}
      if (!data.config) { setNotFound(true); setLoading(false); return }
      setConfig(data.config)
      setMenu(data.menu ?? [])

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSession(sessionData.session)
        if (sessionData.session?.displayName) {
          setName(sessionData.session.displayName)
        }
      }
      setLoading(false)
    }
    load()
  }, [restaurant])

  const bentos = menu.filter((m) => m.category === 'bento')
  const drinks = menu.filter((m) => m.category === 'drink')
  const sides = menu.filter((m) => m.category === 'side')
  const subtotal = menu.reduce((s, m) => s + (cart[m.id] ?? 0) * m.price, 0)
  const total = subtotal - discount
  const totalQty = Object.values(cart).reduce((s, q) => s + q, 0)

  function setQty(id: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }
      if (next[id] === 0) delete next[id]
      return next
    })
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponMsg('')
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}&subtotal=${subtotal}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDiscount(data.discount)
      setCouponMsg(`省下 NT$${data.discount}！`)
    } catch (e: unknown) {
      setCouponMsg(e instanceof Error ? e.message : '優惠券無效')
      setDiscount(0)
    }
  }

  async function handleSubmit() {
    if (!session) { setShowLoginModal(true); return }
    if (!name || !phone || !selectedDate) return
    setSubmitting(true)
    const items = menu
      .filter((m) => (cart[m.id] ?? 0) > 0)
      .map((m) => ({ id: m.id, name_zh: m.name_zh, qty: cart[m.id]!, price: m.price, category: m.category }))
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: restaurant,
          locationId: selectedLocation,
          deliveryDate: format(selectedDate, 'yyyy-MM-dd'),
          items,
          couponCode: couponCode || undefined,
          discount: discount || undefined,
          note,
          customerName: name,
          company,
          phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderResult(data.order)
      setStep('success')
    } catch (e) {
      alert(e instanceof Error ? e.message : '訂購失敗，請再試一次')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf9f0] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">載入中...</p>
      </div>
    )
  }

  if (notFound || !config) {
    return (
      <div className="min-h-screen bg-[#fdf9f0] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle size={48} className="text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700">找不到餐廳</h1>
        <p className="text-gray-400 text-sm">「{restaurant}」尚未開放或網址有誤</p>
        <a href="/" className="text-amber-500 hover:underline text-sm">回首頁</a>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === 'success' && orderResult) {
    return (
      <div className="min-h-screen bg-[#fdf9f0] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle size={44} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-1">訂購成功！</h1>
        <p className="text-gray-500 text-sm mb-1">訂單編號</p>
        <p className="font-mono font-bold text-lg text-gray-800 mb-4">{orderResult.orderNumber}</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 w-full max-w-xs mb-5">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">取餐日期</span>
            <span>{selectedDate && format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">取餐地點</span>
            <span className="text-right max-w-[160px]">{selectedLocation}</span>
          </div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-100">
            <span>應付金額</span>
            <span className="text-green-600">NT$ {orderResult.total}</span>
          </div>
        </div>
        <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 flex items-center gap-1">
          <CheckCircle size={14} /> 訂單已確認，LINE 通知已發送
        </p>
        <button
          onClick={() => { setStep('order'); setCart({}); setOrderResult(null) }}
          className="bg-[#f0a500] hover:bg-[#d89400] text-white font-bold px-8 py-3 rounded-xl transition-colors"
        >
          再訂一次
        </button>
      </div>
    )
  }

  // ── Checkout ─────────────────────────────────────────────────────────────
  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-[#fdf9f0] text-gray-800">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('order')} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-bold text-gray-800">確認訂單</h1>
        </header>

        <div className="max-w-lg mx-auto px-4 py-5 pb-32 space-y-5">
          {/* Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm flex items-center gap-1"><ClipboardList size={14} /> 訂單內容</h2>
            </div>
            <div className="p-4 space-y-2">
              {menu.filter((m) => (cart[m.id] ?? 0) > 0).map((m) => (
                <div key={m.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{m.name_zh} × {cart[m.id]}</span>
                  <span className="font-medium">NT${m.price * cart[m.id]!}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-sm text-gray-500"><span>小計</span><span>NT${subtotal}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>折扣</span><span>-NT${discount}</span></div>}
                <div className="flex justify-between font-bold text-base pt-1"><span>應付金額</span><span className="text-green-600">NT${total}</span></div>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm flex items-center gap-1"><Calendar size={14} /> 取餐資訊</h2>
            </div>
            <div className="p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">日期</span><span>{selectedDate && format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">地點</span><span>{selectedLocation}</span></div>
            </div>
          </div>

          {/* Coupon */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm flex items-center gap-1"><Gift size={14} /> 優惠碼</h2>
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setDiscount(0); setCouponMsg('') }}
                  placeholder="輸入優惠碼"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-amber-400" />
                <button onClick={applyCoupon} className="bg-amber-500 hover:bg-amber-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">套用</button>
              </div>
              {couponMsg && <p className={cn('text-xs mt-1.5', discount > 0 ? 'text-green-600' : 'text-red-500')}>{couponMsg}</p>}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm flex items-center gap-1"><User size={14} /> 訂購人資訊</h2>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: '姓名 *', value: name, onChange: setName, placeholder: '王小明' },
                { label: '公司 / 單位', value: company, onChange: setCompany, placeholder: 'OO科技' },
                { label: '手機 *', value: phone, onChange: setPhone, placeholder: '0912-345-678' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input data-testid={`field-${f.label.replace(/\s*\*\s*/g, '').replace(/\s*\/\s*/g, '-')}`} value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-amber-400" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
          <button onClick={handleSubmit} disabled={submitting || !name || !phone}
            className={cn('w-full py-4 rounded-xl font-bold text-base transition-all',
              name && phone
                ? 'bg-[#f0a500] hover:bg-[#d89400] text-white shadow-lg shadow-amber-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
            {submitting ? '處理中...' : `確認訂購 NT$${total}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Order page ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fdf9f0]">
      {/* Hero banner */}
      <div className="relative h-52 overflow-hidden">
        <Image src={config.banner_path} alt={config.name_zh} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <Image src={config.logo_path} alt={config.name_zh} width={48} height={48} className="object-contain p-1" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl leading-tight">{config.name_zh}</h1>
              <p className="text-white/80 text-xs">{config.address} · {config.phone}</p>
              {config.tagline && <p className="text-amber-300 text-xs font-medium mt-0.5">{config.tagline}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-32 space-y-5">
        {/* Date + Location */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1"><Calendar size={12} /> 取餐日期（僅限平日）</label>
            <div className="relative">
              <button onClick={() => { setDateOpen(!dateOpen); setLocationOpen(false) }}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors',
                  selectedDate ? 'border-amber-400 bg-amber-50 text-gray-800' : 'border-gray-200 text-gray-400')}>
                <span>{selectedDate ? format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW }) : '選擇日期'}</span>
                <ChevronDown size={16} className={cn('transition-transform text-gray-400', dateOpen && 'rotate-180')} />
              </button>
              {dateOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-y-auto max-h-44 z-20">
                  {weekdays.map((d) => (
                    <button key={d.toISOString()} onClick={() => { setSelectedDate(d); setDateOpen(false) }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors',
                        selectedDate?.toDateString() === d.toDateString() ? 'text-amber-600 font-medium bg-amber-50' : 'text-gray-700')}>
                      {format(d, 'yyyy/MM/dd (EEE)', { locale: zhTW })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1"><MapPin size={12} /> 取餐地點</label>
            <div className="relative">
              <button onClick={() => { setLocationOpen(!locationOpen); setDateOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-amber-400 bg-amber-50 text-gray-800 text-sm">
                <span>{selectedLocation}</span>
                <ChevronDown size={16} className={cn('transition-transform text-gray-400', locationOpen && 'rotate-180')} />
              </button>
              {locationOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20">
                  {LOCATIONS.map((l) => (
                    <button key={l} onClick={() => { setSelectedLocation(l); setLocationOpen(false) }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors',
                        selectedLocation === l ? 'text-amber-600 font-medium bg-amber-50' : 'text-gray-700')}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Menu sections */}
        {[
          { label: '便當', icon: ChefHat, items: bentos },
          { label: '小食', icon: Salad, items: sides },
          { label: '加購飲品', icon: CupSoda, items: drinks },
        ].filter((s) => s.items.length > 0).map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-gray-800 flex items-center gap-1"><section.icon size={16} className="text-amber-500" /> {section.label}</h2>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <ProductCard key={item.id} item={item} qty={cart[item.id] ?? 0} onQty={(d) => setQty(item.id, d)} />
              ))}
            </div>
          </div>
        ))}

        {/* Note */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <label className="text-xs font-medium text-gray-500 mb-2 block flex items-center gap-1"><FileText size={12} /> 備註</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="3份不要辣 / 過敏請註明…" rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:border-amber-400" />
        </div>
      </div>

      {/* Checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">共 {totalQty} 項</p>
          <p className="font-black text-xl text-gray-900">NT$ {subtotal}</p>
        </div>
        <button data-testid="checkout-btn" onClick={() => setStep('checkout')} disabled={totalQty === 0 || !selectedDate}
          className={cn('flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all',
            totalQty > 0 && selectedDate
              ? 'bg-[#f0a500] hover:bg-[#d89400] text-white shadow-lg shadow-amber-200 hover:scale-[1.02]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
          <ShoppingBag size={16} />確認訂單
        </button>
      </div>

      {/* Login modal */}
      {showLoginModal && (
        <div data-testid="login-modal"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-white border border-gray-100 rounded-2xl p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-gray-900 font-bold text-xl mb-2">需要先登入</h2>
            <p className="text-gray-500 text-sm mb-6">
              請用 LINE 登入後即可訂購，訂單進度會直接推播給你。
            </p>
            <LoginButton
              redirectAfter={`/${restaurant}`}
              className="w-full flex items-center justify-center gap-3 bg-[#00B900] hover:bg-[#009900] text-white font-bold px-6 py-3 rounded-xl transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ item, qty, onQty }: { item: MenuItemConfig; qty: number; onQty: (d: number) => void }) {
  return (
    <div data-testid={`menu-item-${item.id}`} className={cn('bg-white rounded-2xl shadow-sm border overflow-hidden flex transition-all',
      qty > 0 ? 'border-amber-300' : 'border-gray-100')}>
      {item.image_path && (
        <div className="relative w-24 h-24 flex-shrink-0">
          <Image src={item.image_path} alt={item.name_zh} fill className="object-cover" />
        </div>
      )}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">{item.name_zh}</h3>
          {item.description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{item.description}</p>}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-amber-500">NT${item.price}</span>
          <div className="flex items-center gap-2">
            <button data-testid={`remove-${item.id}`} onClick={() => onQty(-1)} disabled={qty === 0}
              className={cn('w-7 h-7 rounded-full border-2 font-bold flex items-center justify-center transition-all',
                qty > 0 ? 'border-amber-400 text-amber-500 hover:bg-amber-50' : 'border-gray-200 text-gray-300 cursor-not-allowed')}>
              −
            </button>
            <span className="w-5 text-center font-bold text-sm text-gray-800">{qty}</span>
            <button data-testid={`add-${item.id}`} onClick={() => onQty(1)}
              className="w-7 h-7 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-bold flex items-center justify-center transition-colors">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
