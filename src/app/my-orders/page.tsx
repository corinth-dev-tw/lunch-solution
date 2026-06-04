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
  paid: '已付款',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-400/30',
  confirmed: 'bg-green-500/10 text-green-700 border-green-400/30',
  preparing: 'bg-orange-500/10 text-orange-700 border-orange-400/30',
  ready: 'bg-green-500/20 text-green-700 border-green-400/30',
  paid: 'bg-gray-100 text-gray-500 border-gray-200',
  cancelled: 'bg-red-500/10 text-red-700 border-red-400/30',
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 p-6">
        <Package size={48} className="text-gray-300" />
        <div className="text-center">
          <h1 className="text-gray-900 font-bold text-xl mb-2">查看我的訂單</h1>
          <p className="text-gray-500 text-sm">請先登入 LINE 以查看訂單記錄</p>
        </div>
        <LoginButton redirectAfter="/my-orders" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-gray-900 font-bold">我的訂單</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>還沒有訂單</p>
            <button onClick={() => router.push('/')} className="mt-4 text-amber-600 text-sm hover:underline">
              去訂餐
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-gray-900 font-mono text-sm font-bold">{order.order_number}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{order.delivery_date}</p>
                  </div>
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', STATUS_COLOR[order.status])}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  {(order.items ?? []).map((item) => (
                    <p key={item.id} className="text-gray-600 text-sm">
                      {item.menu_item_name} x {item.quantity}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-gray-400 text-xs">{order.location_id}</span>
                  <span className="text-gray-900 font-bold">NT$ {order.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
