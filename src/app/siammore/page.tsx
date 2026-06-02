'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { format, addDays, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, CheckCircle, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Product catalogue ────────────────────────────────────────────────────────
const BENTOS = [
  { id: 'qtan',  name: 'Q彈好咖餐盒',  desc: '脆口炸雞腿 + 雙主菜 + 三配菜，Q彈鮮嫩超滿足', price: 200, img: '/siammore/products/qtan-bento.jpg' },
  { id: 'basil', name: '開胃扒飯餐盒', desc: '香辣打拋豬 + 雙主菜 + 三配菜，開胃夠味泰式風', price: 200, img: '/siammore/products/basil-bento.jpg' },
  { id: 'kacha', name: '咔滋爆爽餐盒', desc: '咔滋嫩牛 + 雙主菜 + 三配菜，爽脆口感每口過癮', price: 200, img: '/siammore/products/kacha-bento.jpg' },
]
const DRINKS = [
  { id: 'milk-tea',   name: '泰式奶茶',  desc: '濃郁奶香，泰式經典', price: 60, img: '/siammore/products/thai-milk-tea.jpg' },
  { id: 'lemon',      name: '泰式檸檬飲', desc: '清爽酸甜，消暑解膩', price: 50, img: '/siammore/products/lemon-drink.jpg' },
]

type Product = typeof BENTOS[number]

// ─── Available weekday dates (tomorrow → +30 days) ────────────────────────────
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

const LOCATIONS = ['台北101辦公大樓', '台北交易廣場', '世界貿易中心', '信義區松高路16號3樓（自取）']

// ─── Component ────────────────────────────────────────────────────────────────
type Step = 'order' | 'checkout' | 'success'

export default function SiammorePage() {
  const weekdays = useMemo(getWeekdays, [])
  const [step, setStep] = useState<Step>('order')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0])
  const [dateOpen, setDateOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [note, setNote] = useState('')
  // Checkout fields
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; total: number; sheetsWritten: boolean; devMode?: boolean } | null>(null)

  const allProducts = [...BENTOS, ...DRINKS]
  const totalQty = Object.values(cart).reduce((s, q) => s + q, 0)
  const subtotal = allProducts.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price, 0)
  const total = subtotal - discount

  function setQty(id: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }
      if (next[id] === 0) delete next[id]
      return next
    })
  }

  async function applyCoupon() {
    // Simple local validation — extend to API call when DB is set up
    const CODES: Record<string, number> = { LUNCH50: 50, NEWUSER: 100, THAI10: 80 }
    const v = CODES[couponCode.toUpperCase()]
    if (!v) { setCouponMsg('優惠券不存在'); setDiscount(0); return }
    if (subtotal < 200) { setCouponMsg('最低消費 $200 才可使用'); setDiscount(0); return }
    setDiscount(Math.min(v, subtotal))
    setCouponMsg(`省下 $${Math.min(v, subtotal)}！`)
  }

  async function handleSubmit() {
    if (!name || !phone || !selectedDate) return
    setSubmitting(true)
    const items = allProducts
      .filter((p) => (cart[p.id] ?? 0) > 0)
      .map((p) => ({
        name: p.name,
        qty: cart[p.id],
        price: p.price,
        category: BENTOS.find((b) => b.id === p.id) ? 'bento' : 'drink' as 'bento' | 'drink',
      }))
    try {
      const res = await fetch('/api/siammore/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: format(selectedDate, 'yyyy-MM-dd'),
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

  // ── Success screen ───────────────────────────────────────────────────────
  if (step === 'success' && orderResult) {
    return (
      <div className="min-h-screen bg-[#fdf9f0] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle size={44} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-1">訂購成功！</h1>
        <p className="text-gray-500 text-sm mb-1">訂單編號</p>
        <p className="font-mono font-bold text-lg text-gray-800 mb-3">{orderResult.orderNumber}</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 w-full max-w-xs mb-5">
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">取餐日期</span><span>{selectedDate && format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })}</span></div>
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">取餐地點</span><span>{selectedLocation}</span></div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-100"><span>應付金額</span><span className="text-green-600">NT$ {orderResult.total}</span></div>
        </div>
        {orderResult.devMode && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            開發模式：Google Sheets 未設定，訂單未寫入試算表
          </p>
        )}
        {orderResult.sheetsWritten && (
          <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4">
            ✅ 已寫入 Google Sheets
          </p>
        )}
        <button onClick={() => { setStep('order'); setCart({}); setOrderResult(null) }}
          className="bg-[#f0a500] hover:bg-[#d89400] text-white font-bold px-8 py-3 rounded-xl transition-colors">
          再訂一次
        </button>
      </div>
    )
  }

  // ── Checkout screen ──────────────────────────────────────────────────────
  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-[#fdf9f0]">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('order')} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-bold text-gray-800">確認訂單</h1>
        </header>

        <div className="max-w-lg mx-auto px-4 py-5 pb-32 space-y-5">
          {/* Order summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bold text-gray-700 text-sm">📋 訂單內容</h2>
            </div>
            <div className="p-4 space-y-2">
              {allProducts.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{p.name} × {cart[p.id]}</span>
                  <span className="font-medium">NT${p.price * cart[p.id]!}</span>
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
                <input value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setDiscount(0); setCouponMsg('') }}
                  placeholder="輸入優惠碼"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                <button onClick={applyCoupon}
                  className="bg-amber-500 hover:bg-amber-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
                  套用
                </button>
              </div>
              {couponMsg && <p className={cn('text-xs mt-1.5', discount > 0 ? 'text-green-600' : 'text-red-500')}>{couponMsg}</p>}
            </div>
          </div>

          {/* Customer info */}
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

        {/* Fixed bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || !phone}
            className={cn(
              'w-full py-4 rounded-xl font-bold text-base transition-all',
              name && phone
                ? 'bg-[#f0a500] hover:bg-[#d89400] text-white shadow-lg shadow-amber-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}>
            {submitting ? '處理中...' : `✅ 確認訂購 NT$${total}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Order screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fdf9f0]">
      {/* Hero banner */}
      <div className="relative h-52 overflow-hidden">
        <Image src="/siammore/banners/banner-siammore.jpg" alt="饗泰多" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <Image src="/siammore/logo/siammore logo.png" alt="饗泰多" width={48} height={48} className="object-contain p-1" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl leading-tight">饗泰多 松高店</h1>
              <p className="text-white/80 text-xs">信義區松高路16號3樓 · 02-2722-1728</p>
              <p className="text-amber-300 text-xs font-medium mt-0.5">雙主菜 + 三配菜 · 超有料餐盒</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-32 space-y-5">
        {/* Date + Location */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">📅 取餐日期（僅限平日）</label>
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
          {/* Location */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">📍 取餐地點</label>
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

        {/* Bento section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🍱</span>
            <h2 className="font-bold text-gray-800">便當</h2>
            <span className="text-xs text-gray-400 ml-auto">每盒 NT$200</span>
          </div>
          <div className="space-y-3">
            {BENTOS.map((p) => <ProductCard key={p.id} product={p} qty={cart[p.id] ?? 0} onQty={(d) => setQty(p.id, d)} />)}
          </div>
        </div>

        {/* Drinks section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🥤</span>
            <h2 className="font-bold text-gray-800">加購飲品</h2>
          </div>
          <div className="space-y-3">
            {DRINKS.map((p) => <ProductCard key={p.id} product={p} qty={cart[p.id] ?? 0} onQty={(d) => setQty(p.id, d)} />)}
          </div>
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <label className="text-xs font-medium text-gray-500 mb-2 block">📝 備註</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="3份不要辣 / 過敏請註明…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-400" />
        </div>
      </div>

      {/* Fixed checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">共 {totalQty} 項</p>
          <p className="font-black text-xl text-gray-900">NT$ {subtotal}</p>
        </div>
        <button
          onClick={() => setStep('checkout')}
          disabled={totalQty === 0 || !selectedDate}
          className={cn(
            'flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all',
            totalQty > 0 && selectedDate
              ? 'bg-[#f0a500] hover:bg-[#d89400] text-white shadow-lg shadow-amber-200 hover:scale-[1.02]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}>
          <ShoppingBag size={16} />
          確認訂單
        </button>
      </div>
    </div>
  )
}

// ─── Product card sub-component ───────────────────────────────────────────────
function ProductCard({ product, qty, onQty }: { product: Product; qty: number; onQty: (d: number) => void }) {
  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm border overflow-hidden flex transition-all',
      qty > 0 ? 'border-amber-300' : 'border-gray-100'
    )}>
      <div className="relative w-24 h-24 flex-shrink-0">
        <Image src={product.img} alt={product.name} fill className="object-cover" />
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">{product.name}</h3>
          <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{product.desc}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-amber-500">NT${product.price}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onQty(-1)} disabled={qty === 0}
              className={cn('w-7 h-7 rounded-full border-2 text-base font-bold transition-all flex items-center justify-center',
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
