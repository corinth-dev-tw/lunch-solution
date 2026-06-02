'use client'

import { useState } from 'react'
import { Plus, Minus, ShoppingBag } from 'lucide-react'
import { MenuItem, CartItem } from '@/types'
import { cn } from '@/lib/utils'

interface BentoMenuProps {
  items: MenuItem[]
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
}

export default function BentoMenu({ items, cart, onUpdateCart }: BentoMenuProps) {
  const categories = [...new Set(items.map((i) => i.category))]

  function getQuantity(itemId: string): number {
    return cart.find((c) => c.menu_item.id === itemId)?.quantity ?? 0
  }

  function updateQuantity(item: MenuItem, delta: number) {
    const existing = cart.find((c) => c.menu_item.id === item.id)
    const newQty = (existing?.quantity ?? 0) + delta
    if (newQty <= 0) {
      onUpdateCart(cart.filter((c) => c.menu_item.id !== item.id))
    } else if (existing) {
      onUpdateCart(cart.map((c) => c.menu_item.id === item.id ? { ...c, quantity: newQty } : c))
    } else {
      onUpdateCart([...cart, { menu_item: item, quantity: newQty }])
    }
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <ShoppingBag size={16} className="text-green-400" />
            {category === 'bento' ? '精選便當' : category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items
              .filter((item) => item.category === category && item.available)
              .map((item) => {
                const qty = getQuantity(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'bg-white/5 border rounded-xl p-4 transition-all',
                      qty > 0 ? 'border-green-400/40 bg-green-500/5' : 'border-white/10'
                    )}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name_zh}
                        className="w-full h-28 object-cover rounded-lg mb-3"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{item.name_zh}</h4>
                        {item.description && (
                          <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                        <p className="text-green-400 font-bold mt-2">NT$ {item.price}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {qty > 0 ? (
                          <>
                            <button
                              onClick={() => updateQuantity(item, -1)}
                              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-white font-bold w-5 text-center text-sm">{qty}</span>
                          </>
                        ) : null}
                        <button
                          onClick={() => updateQuantity(item, 1)}
                          className="w-7 h-7 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center text-white transition-colors shadow-lg shadow-green-500/25"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
