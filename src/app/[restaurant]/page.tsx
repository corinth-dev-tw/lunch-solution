'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import { format, addDays, startOfDay, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, CheckCircle, ShoppingBag, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { XINYI_LOCATIONS } from '@/lib/constants/locations'
import type { RestaurantConfig, MenuItemConfig } from '@/lib/google/registry'

function getWeekdays(): Date[] {
  const today = startOfDay(new Date())
  const days: Date[] = []
  for (let i = 1; i <= 30; i++) {
    const d = addDays(today, i)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days.push(d)
  }
  return days
}

const COUPON_CODES: Record<string, number> = { LUNCH50: 50, NEWUSER: 100, THAI10: 80 }

type Step = 'order' | 'checkout' | 'success'

interface LineSession {
  displayName: string
  pictureUrl?: string
  memberId?: string
}

const CART_KEY = 'lunch_pending_cart'

export default function RestaurantPage() {
  const { restaurant } = useParams<{ restaurant: string }>()
  const searchParams = useSearchParams()
  const weekdays = useMemo(getWeekdays, [])

  const [config, setConfig] = useState<RestaurantConfig | null>(null)
  const [menu, setMenu] = useState<MenuItemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep] = useState<Step>('order')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [session, setSession] = useState<LineSession | null>(null)

  // Initialise date and location from URL query params
  const initLocation = useMemo(() => {
    const locationId = searchParams.get('location')
    if (!locationId) return null
    const match = XINYI_LOCATIONS.find((l) => l.id === locationId)
    return match?.name_zh ?? null
  }, [searchParams])

  const initDate = useMemo(() => {
    const dateStr = searchParams.get('date')
    if (!dateStr) return null
    try {
      const d = parseISO(dateStr)
      return isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }, [searchParams])

  const [selectedDate, setSelectedDate] = useState<Date | null>(initDate)
  const [selectedLocation, setSelectedLocation] = useState<string>(
    initLocation ?? XINYI_LOCATIONS[0].name_zh
  )
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [dateOpen, setDateOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [note, setNote] = useState('')

  // Checkout fields
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    orderNumber: string; total: number; sheetsWritten: boolean; devMode?: boolean
  } | null>(null)

  // Load config + menu + session in parallel
  useEffect(() => {
    async function load() {
      const [configRes, sessionRes] = await Promise.all([
        fetch(`/api/restaurants/${restaurant}/config`),
        fetch('/api/auth/session'),
      ])

      if (!configRes.ok) { setNotFound(true); setLoading(false); return }
      const configData = await configRes.json()
      if (!configData.config) { setNotFound(true); setLoading(false); return }
      setConfig(configData.config)
      setMenu(configData.menu ?? [])

      if (sessionRes.ok) {
        const { session: s } = await sessionRes.json()
        if (s) {
          setSession(s)
          setName((prev) => prev || s.displayName)
        }
      }

      setLoading(false)
    }
    load()
  }, [restaurant])

  // Set default time when config loads
  useEffect(() => {
    if (config?.delivery_times?.length && !selectedTime) {
      setSelectedTime(config.delivery_times[0])
    }
  }, [config, selectedTime])

  // Restore cart saved before LINE login redirect
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CART_KEY)
      if (saved) {
        const { cart: savedCart } = JSON.parse(saved) as { cart: Record<string, number> }
        if (savedCart && Object.keys(savedCart).length > 0) setCart(savedCart)
        sessionStorage.removeItem(CART_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  const locations = XINYI_LOCATIONS.map((l) => l.name_zh)
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

  function applyCoupon() {
    const v = COUPON_CODES[couponCode.toUpperCase()]
    if (!v) { setCouponMsg('優惠券不存在'); setDiscount(0); return }
    if (subtotal < 200) { setCouponMsg('最低消費 $200 才可使用'); setDiscount(0); return }
    setDiscount(Math.min(v, subtotal))
    setCouponMsg(`省下 $${Math.min(v, subtotal)}！`)
  }

  function goToCheckout() {
    if (!session) {
      // Save cart and redirect to LINE login, returning here after auth
      try {
        sessionStorage.setItem(CART_KEY, JSON.stringify({ cart }))
      } catch { /* ignore */ }
      const returnUrl = `/${restaurant}?location=${searchParams.get('location') ?? ''}&date=${searchParams.get('date') ?? ''}`
      window.location.href = `/api/auth/line?redirect=${encodeURIComponent(returnUrl)}`
      return
    }
    setStep('checkout')
  }

  async function handleSubmit() {
    if (!name || !phone || !selectedDate) return
    setSubmitting(true)
    const items = menu
      .filter((m) => (cart[m.id] ?? 0) > 0)
      .map((m) => ({ name: m.name_zh, qty: cart[m.id]!, price: m.price, category: m.category }))
    try {
      const res = await fetch(`/api/restaurants/${restaurant}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: format(selectedDate, 'yyyy-MM-dd'),
          deliveryTime: selectedTime,
          locationName: selectedLocation,
          customerName: name,
          company,
          phone,
          items,
          couponCode: couponCode || undefined,
          discount: discount || undefined,
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderResult(data)
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
          {selectedTime && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">取餐時間</span>
              <span>{selectedTime}</span>
            </div>
          )}
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">取餐地點</span>
            <span className="text-right max-w-[160px]">{selectedLocation}</span>
          </div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-100">
            <span>應付金額</span>
            <span className="text-green-600">NT$ {orderResult.total}</span>
          </div>
        </div>
        {orderResult.devMode && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            開發模式：Google Sheets 未設定，訂單未寫入試算表
          </p>
        )}
        {orderResult.sheetsWritten && (
          <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4">
            ✅ 訂單已寫入 Google Sheets
          </p>
        )}
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
      <div className="min-h-screen bg-[#fdf9f0]">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('order')} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-bold text-gray-800">確認訂單</h1>
          {session && (
            <div className="ml-auto flex items-center gap-2">
              {session.pictureUrl && (
                <img src={session.pictureUrl} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="text-gray-500 text-xs">{session.displayName}</span>
            </div>
          )}
        </header>

        <div className="max-w-lg mx-auto px-4 py-5 pb-32 space-y-5">
          {/* Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm">📋 訂單內容</h2>
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
              <h2 className="font-bold text-gray-700 text-sm">📅 取餐資訊</h2>
            </div>
            <div className="p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">日期</span><span>{selectedDate && format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })}</span></div>
              {selectedTime && <div className="flex justify-between"><span className="text-gray-500">時間</span><span>{selectedTime}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">地點</span><span>{selectedLocation}</span></div>
            </div>
          </div>

          {/* Coupon */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm">🎁 優惠碼</h2>
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setDiscount(0); setCouponMsg('') }}
                  placeholder="輸入優惠碼"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                <button onClick={applyCoupon} className="bg-amber-500 hover:bg-amber-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">套用</button>
              </div>
              {couponMsg && <p className={cn('text-xs mt-1.5', discount > 0 ? 'text-green-600' : 'text-red-500')}>{couponMsg}</p>}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm">👤 訂購人資訊</h2>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: '姓名 *', value: name, onChange: setName, placeholder: '王小明' },
                { label: '公司 / 單位', value: company, onChange: setCompany, placeholder: 'OO科技' },
                { label: '手機 *', value: phone, onChange: setPhone, placeholder: '0912-345-678' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
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
            {submitting ? '處理中...' : `✅ 確認訂購 NT$${total}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Order page ────────────────────────────────────────────────────────────
  const deliveryTimes = config.delivery_times ?? ['11:30', '12:00', '12:30']
  const canCheckout = totalQty > 0 && !!selectedDate && !!selectedTime

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
            {session && (
              <div className="ml-auto flex items-center gap-2">
                {session.pictureUrl && (
                  <img src={session.pictureUrl} alt="" className="w-8 h-8 rounded-full border-2 border-white/30" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-32 space-y-5">
        {/* Date + Location + Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">📅 取餐日期（僅限平日）</label>
            <div className="relative">
              <button onClick={() => { setDateOpen(!dateOpen); setLocationOpen(false); setTimeOpen(false) }}
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

          {/* Time */}
          {deliveryTimes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block flex items-center gap-1">
                <Clock size={11} /> 取餐時間
              </label>
              <div className="relative">
                <button onClick={() => { setTimeOpen(!timeOpen); setDateOpen(false); setLocationOpen(false) }}
                  className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors',
                    selectedTime ? 'border-amber-400 bg-amber-50 text-gray-800' : 'border-gray-200 text-gray-400')}>
                  <span>{selectedTime || '選擇時段'}</span>
                  <ChevronDown size={16} className={cn('transition-transform text-gray-400', timeOpen && 'rotate-180')} />
                </button>
                {timeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20">
                    {deliveryTimes.map((t) => (
                      <button key={t} onClick={() => { setSelectedTime(t); setTimeOpen(false) }}
                        className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors',
                          selectedTime === t ? 'text-amber-600 font-medium bg-amber-50' : 'text-gray-700')}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">📍 取餐地點</label>
            <div className="relative">
              <button onClick={() => { setLocationOpen(!locationOpen); setDateOpen(false); setTimeOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-amber-400 bg-amber-50 text-gray-800 text-sm">
                <span>{selectedLocation}</span>
                <ChevronDown size={16} className={cn('transition-transform text-gray-400', locationOpen && 'rotate-180')} />
              </button>
              {locationOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20">
                  {locations.map((l) => (
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
          { label: '🍱 便當', items: bentos },
          { label: '🥗 小食', items: sides },
          { label: '🥤 加購飲品', items: drinks },
        ].filter((s) => s.items.length > 0).map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-gray-800">{section.label}</h2>
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
          <label className="text-xs font-medium text-gray-500 mb-2 block">📝 備註</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="3份不要辣 / 過敏請註明…" rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-400" />
        </div>
      </div>

      {/* Checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">共 {totalQty} 項</p>
          <p className="font-black text-xl text-gray-900">NT$ {subtotal}</p>
        </div>
        <button
          onClick={goToCheckout}
          disabled={!canCheckout}
          className={cn('flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all',
            canCheckout
              ? 'bg-[#f0a500] hover:bg-[#d89400] text-white shadow-lg shadow-amber-200 hover:scale-[1.02]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
          <ShoppingBag size={16} />
          {session ? '確認訂單' : '登入並訂購'}
        </button>
      </div>
    </div>
  )
}

function ProductCard({ item, qty, onQty }: { item: MenuItemConfig; qty: number; onQty: (d: number) => void }) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-sm border overflow-hidden flex transition-all',
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
            <button onClick={() => onQty(-1)} disabled={qty === 0}
              className={cn('w-7 h-7 rounded-full border-2 font-bold flex items-center justify-center transition-all',
                qty > 0 ? 'border-amber-400 text-amber-500 hover:bg-amber-50' : 'border-gray-200 text-gray-300 cursor-not-allowed')}>
              −
            </button>
            <span className="w-5 text-center font-bold text-sm text-gray-800">{qty}</span>
            <button onClick={() => onQty(1)}
              className="w-7 h-7 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-bold flex items-center justify-center transition-colors">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
