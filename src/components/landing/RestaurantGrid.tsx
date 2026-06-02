'use client'

import Image from 'next/image'
import { Store, Clock, Tag } from 'lucide-react'
import { Restaurant } from '@/types'
import { cn } from '@/lib/utils'

interface RestaurantGridProps {
  restaurants: Restaurant[]
  loading: boolean
  onSelect: (restaurant: Restaurant) => void
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
]

export default function RestaurantGrid({ restaurants, loading, onSelect }: RestaurantGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl h-64 animate-pulse" />
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 text-white/50">
        <Store size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg">此地點目前無可訂餐廳</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {restaurants.map((restaurant, idx) => (
        <button
          key={restaurant.id}
          onClick={() => onSelect(restaurant)}
          className="group text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-400/30 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/10"
        >
          <div className="relative h-44 overflow-hidden">
            <img
              src={restaurant.image_url || PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length]}
              alt={restaurant.name_zh}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {restaurant.delivery_fee === 0 && (
              <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                免運費
              </span>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-white font-bold text-base mb-1">{restaurant.name_zh}</h3>
            <p className="text-white/50 text-xs mb-3 line-clamp-2">{restaurant.description}</p>
            <div className="flex items-center gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                截單時間 {String(restaurant.cutoff_hour).padStart(2, '0')}:00
              </span>
              {restaurant.min_order > 0 && (
                <span className="flex items-center gap-1">
                  <Tag size={12} />
                  最低 ${restaurant.min_order}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
