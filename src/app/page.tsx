'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Location, Restaurant } from '@/types'
import LocationDatePicker from '@/components/landing/LocationDatePicker'
import RestaurantGrid from '@/components/landing/RestaurantGrid'
import LoginButton from '@/components/line/LoginButton'
import { ChevronDown, Utensils, Clock, MapPin } from 'lucide-react'

const XinyiMap = dynamic(() => import('@/components/map/XinyiMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <p className="text-white/50 animate-pulse">載入地圖中...</p>
    </div>
  ),
})

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  state:   '登入逾時或連結失效，請再試一次',
  token:   'LINE 驗證失敗，請再試一次',
  nonce:   '安全驗證失敗，請再試一次',
  profile: '無法取得 LINE 個人資料，請再試一次',
  cfg:     '系統設定錯誤，請聯絡管理員',
}

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const authError = searchParams.get('error')
  const restaurantSectionRef = useRef<HTMLDivElement>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(false)
  const [showRestaurants, setShowRestaurants] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [dismissedError, setDismissedError] = useState(false)

  useEffect(() => {
    fetch('/api/locations')
      .then((r) => r.json())
      .then((d) => { if (d.locations?.length) setLocations(d.locations) })
      .catch(() => {}) // silently fall back to default locations in LocationDatePicker
  }, [])

  async function handleConfirm() {
    if (!selectedLocation || !selectedDate) return
    setLoadingRestaurants(true)
    setShowRestaurants(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const res = await fetch(`/api/restaurants?location=${selectedLocation.id}&date=${dateStr}`)
    const data = res.ok ? await res.json() : { restaurants: [] }
    setRestaurants(data.restaurants ?? [])
    setLoadingRestaurants(false)
    setTimeout(() => restaurantSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function handleSelectRestaurant(restaurant: Restaurant) {
    if (!selectedLocation || !selectedDate) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    router.push(`/${restaurant.id}?location=${selectedLocation.id}&date=${dateStr}`)
  }

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Auth error banner */}
      {authError && !dismissedError && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-between gap-3 bg-red-500/90 backdrop-blur px-4 py-3 text-white text-sm">
          <span>{AUTH_ERROR_MESSAGES[authError] ?? '登入失敗，請再試一次'}</span>
          <button
            onClick={() => { setDismissedError(true); router.replace('/') }}
            className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
          >
            關閉
          </button>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gray-950/80 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-2">
          <Utensils size={20} className="text-green-400" />
          <span className="font-bold text-white">信義午餐</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/my-orders" className="text-white/60 hover:text-white text-sm transition-colors">
            我的訂單
          </a>
          <LoginButton className="text-sm bg-[#00B900] hover:bg-[#009900] text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            LINE 登入
          </LoginButton>
        </div>
      </nav>

      {/* Hero with 3D Map */}
      <section className="relative h-screen">
        <div className="absolute inset-0">
          <XinyiMap selectedLocation={selectedLocation} onSelectLocation={setSelectedLocation} />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/80 via-gray-950/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <div className="px-8 md:px-16 max-w-lg pointer-events-auto">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 text-green-400 text-xs font-medium mb-4">
              <MapPin size={12} />
              信義區美食直送
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-3">
              百貨餐廳<br />
              <span className="text-green-400">外送到你辦公桌</span>
            </h1>
            <p className="text-white/60 text-base mb-8 leading-relaxed">
              精選信義區百貨美食街餐廳，每日限量便當，提前預訂，準時外送。
            </p>

            <LocationDatePicker
              selectedLocation={selectedLocation}
              selectedDate={selectedDate}
              onSelectLocation={setSelectedLocation}
              onSelectDate={setSelectedDate}
              onConfirm={handleConfirm}
              locations={locations.length > 0 ? locations : undefined}
            />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 flex flex-col items-center gap-1 animate-bounce">
          <span className="text-xs">點擊地圖上的地標選擇地點</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* Features strip */}
      <section className="py-12 px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: '🏢', title: '辦公大樓直送', desc: '台北101、交易廣場等主要大樓' },
            { icon: '📱', title: 'LINE 即時通知', desc: '訂單每個狀態都推播給你' },
            { icon: '🍱', title: '百貨美食品質', desc: '精選信義區知名餐廳便當' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-3">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="text-white font-bold">{f.title}</h3>
              <p className="text-white/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Restaurant section */}
      {showRestaurants && (
        <section ref={restaurantSectionRef} className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">
                {selectedLocation?.name_zh} 可訂餐廳
              </h2>
              {selectedDate && (
                <p className="text-white/50 text-sm flex items-center gap-1.5">
                  <Clock size={13} />
                  {format(selectedDate, 'yyyy年MM月dd日')} 取餐
                </p>
              )}
            </div>
            <RestaurantGrid
              restaurants={restaurants}
              loading={loadingRestaurants}
              onSelect={handleSelectRestaurant}
            />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-white/30 text-sm">
        © 2025 信義午餐 · 讓百貨美食觸手可及
      </footer>
    </main>
  )
}
