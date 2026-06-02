'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { Order, OrderStatus } from '@/types'
import { cn } from '@/lib/utils'
import LoginButton from '@/components/line/LoginButton'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待確認',
  confirmed: '已確認',
  preparing: '備餐中',
  ready: '可取餐',
  delivered: '已送達',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-400/20',
  confirmed: 'bg-green-500/10 text-green-400 border-green-400/20',
  preparing: 'bg-orange-500/10 text-orange-400 border-orange-400/20',
  ready: 'bg-green-500/20 text-green-300 border-green-400/30',
  delivered: 'bg-white/5 text-white/50 border-white/10',
  cancelled: 'bg-red-500/10 text-red-400 border-red-400/20',
}

export default function MyOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { setIsLoggedIn(false); setLoading(false); return }
      setIsLoggedIn(true)
      const res = await fetch('/api/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (isLoggedIn === false) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 p-6">
        <Package size={48} className="text-white/20" />
        <div className="text-center">
          <h1 className="text-white font-bold text-xl mb-2">查看我的訂單</h1>
          <p className="text-white/50 text-sm">請先登入 LINE 以查看訂單記錄</p>
        </div>
        <LoginButton redirectAfter="/my-orders" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white font-bold">我的訂單</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>還沒有訂單</p>
            <button onClick={() => router.push('/')} className="mt-4 text-green-400 text-sm hover:underline">
              去訂餐 →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-mono text-sm font-bold">{order.order_number}</p>
                    <p className="text-white/50 text-xs mt-0.5">{order.delivery_date}</p>
                  </div>
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', STATUS_COLOR[order.status])}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  {(order.items ?? []).map((item) => (
                    <p key={item.id} className="text-white/60 text-sm">
                      {item.menu_item_name} × {item.quantity}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-white/50 text-xs">{order.location_id}</span>
                  <span className="text-white font-bold">NT$ {order.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
