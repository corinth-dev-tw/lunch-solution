'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Location, Restaurant } from '@/types'
import LocationDatePicker from '@/components/landing/LocationDatePicker'
import RestaurantGrid from '@/components/landing/RestaurantGrid'
import LoginButton from '@/components/line/LoginButton'
import { ChevronDown, Utensils, Clock, MapPin, Building2, Smartphone, UtensilsCrossed } from 'lucide-react'

const XinyiMap = dynamic(() => import('@/components/map/XinyiMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">載入地圖中...</p>
    </div>
  ),
})

export default function HomePage() {
  const router = useRouter()
  const restaurantSectionRef = useRef<HTMLDivElement>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(false)
  const [showRestaurants, setShowRestaurants] = useState(false)

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
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Utensils size={20} className="text-amber-500" />
          <span className="font-bold text-gray-900">信義午餐</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/my-orders" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">
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
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <div className="px-8 md:px-16 max-w-lg pointer-events-auto">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-amber-600 text-xs font-medium mb-4">
              <MapPin size={12} />
              信義區美食直送
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-3">
              百貨餐廳<br />
              <span className="text-amber-500">外送到你辦公桌</span>
            </h1>
            <p className="text-gray-500 text-base mb-8 leading-relaxed">
              精選信義區百貨美食街餐廳，每日限量便當，提前預訂，準時外送。
            </p>

            <LocationDatePicker
              selectedLocation={selectedLocation}
              selectedDate={selectedDate}
              onSelectLocation={setSelectedLocation}
              onSelectDate={setSelectedDate}
              onConfirm={handleConfirm}
            />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-400 flex flex-col items-center gap-1 animate-bounce">
          <span className="text-xs">點擊地圖上的地標選擇地點</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* Features strip */}
      <section className="py-12 px-6 border-y border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: Building2, title: '辦公大樓直送', desc: '台北101、交易廣場等主要大樓' },
            { icon: Smartphone, title: 'LINE 即時通知', desc: '訂單每個狀態都推播給你' },
            { icon: UtensilsCrossed, title: '百貨美食品質', desc: '精選信義區知名餐廳便當' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-3">
              <f.icon size={32} className="text-amber-500" />
              <h3 className="text-gray-900 font-bold">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Restaurant section */}
      {showRestaurants && (
        <section ref={restaurantSectionRef} className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {selectedLocation?.name_zh} 可訂餐廳
              </h2>
              {selectedDate && (
                <p className="text-gray-500 text-sm flex items-center gap-1.5">
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
      <footer className="py-8 px-6 border-t border-gray-200 text-center text-gray-400 text-sm">
        2025 信義午餐
      </footer>
    </main>
  )
}
