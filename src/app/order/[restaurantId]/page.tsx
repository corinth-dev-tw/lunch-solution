'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { MenuItem, CartItem, Restaurant } from '@/types'
import BentoMenu from '@/components/order/BentoMenu'
import OrderCart from '@/components/order/OrderCart'
import LoginButton from '@/components/line/LoginButton'

interface Session {
  displayName: string
  pictureUrl?: string
}

export default function OrderPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationId = searchParams.get('location') ?? ''
  const deliveryDate = searchParams.get('date') ?? ''

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [menuRes, sessionRes] = await Promise.all([
        fetch(`/api/menu/${restaurantId}`),
        fetch('/api/auth/session'),
      ])
      const menuData = menuRes.ok ? await menuRes.json() : { items: [] }
      setMenuItems(menuData.items ?? [])

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSession(sessionData.session)
      }
      setLoading(false)
    }
    load()
  }, [restaurantId])

  async function handleSubmit(couponCode: string, note: string) {
    if (!session) { setShowLoginModal(true); return }
    setSubmitting(true)
    setOrderError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          locationId,
          deliveryDate,
          items: cart,
          couponCode: couponCode || undefined,
          specialNote: note || undefined,
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderNumber(data.order.order_number)
      setCart([])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setOrderError('請求逾時，請再試一次')
      } else {
        setOrderError(e instanceof Error ? e.message : '訂購失敗，請再試一次')
      }
    } finally {
      clearTimeout(timeout)
      setSubmitting(false)
    }
  }

  if (orderNumber) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">訂購成功！</h1>
          <p className="text-white/60 mb-2">訂單編號：<span className="text-white font-mono">{orderNumber}</span></p>
          <p className="text-white/50 text-sm mb-8">LINE 通知已發送，請注意 LINE 訊息以追蹤訂單進度。</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/my-orders')}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-medium rounded-xl transition-colors"
            >
              查看訂單
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
            >
              回首頁
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-white font-bold text-sm">點餐</h1>
          <p className="text-white/50 text-xs">{deliveryDate} · 取餐地點 {locationId}</p>
        </div>
        {session && (
          <div className="ml-auto flex items-center gap-2">
            {session.pictureUrl && (
              <img src={session.pictureUrl} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-white/70 text-xs">{session.displayName}</span>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <BentoMenu items={menuItems} cart={cart} onUpdateCart={setCart} />
          )}
        </div>

        {/* Cart */}
        <div className="lg:sticky lg:top-20 self-start space-y-3">
          {orderError && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {orderError}
            </div>
          )}
          <OrderCart
            cart={cart}
            deliveryFee={0}
            onUpdateCart={setCart}
            onSubmit={handleSubmit}
            submitting={submitting}
            isLoggedIn={!!session}
            onLoginRequired={() => setShowLoginModal(true)}
          />
        </div>
      </div>

      {/* Login modal */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white font-bold text-xl mb-2">需要先登入</h2>
            <p className="text-white/50 text-sm mb-6">
              請用 LINE 登入後即可訂購，訂單進度會直接推播給你。
            </p>
            <LoginButton
              redirectAfter={`/order/${restaurantId}?location=${locationId}&date=${deliveryDate}`}
              className="w-full flex items-center justify-center gap-3 bg-[#00B900] hover:bg-[#009900] text-white font-bold px-6 py-3 rounded-xl transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}
