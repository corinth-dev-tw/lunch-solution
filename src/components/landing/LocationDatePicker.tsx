'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronDown, MapPin, Calendar } from 'lucide-react'
import { Location } from '@/types'
import { XINYI_LOCATIONS } from '@/lib/constants/locations'
import { getAvailableDates, cn } from '@/lib/utils'

interface LocationDatePickerProps {
  selectedLocation: Location | null
  selectedDate: Date | null
  onSelectLocation: (location: Location) => void
  onSelectDate: (date: Date) => void
  onConfirm: () => void
  locations?: Location[]
}

export default function LocationDatePicker({
  selectedLocation,
  selectedDate,
  onSelectLocation,
  onSelectDate,
  onConfirm,
  locations = XINYI_LOCATIONS,
}: LocationDatePickerProps) {
  const [locationOpen, setLocationOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const availableDates = getAvailableDates()

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl w-full max-w-sm">
      <h2 className="text-white font-bold text-lg mb-4 text-center">預訂午餐便當</h2>

      {/* Location Selector */}
      <div className="mb-3">
        <label className="text-white/70 text-xs font-medium mb-1 block flex items-center gap-1">
          <MapPin size={12} /> 取餐地點
        </label>
        <div className="relative">
          <button
            onClick={() => { setLocationOpen(!locationOpen); setDateOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
              selectedLocation
                ? 'bg-green-500/20 border border-green-400/50 text-white'
                : 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15'
            )}
          >
            <span>{selectedLocation ? selectedLocation.name_zh : '選擇辦公大樓'}</span>
            <ChevronDown size={16} className={cn('transition-transform', locationOpen && 'rotate-180')} />
          </button>
          {locationOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900/95 backdrop-blur border border-white/20 rounded-xl overflow-hidden z-50 shadow-2xl">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => { onSelectLocation(loc); setLocationOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/10',
                    selectedLocation?.id === loc.id ? 'text-green-400 bg-green-500/10' : 'text-white/80'
                  )}
                >
                  <div className="font-medium">{loc.name_zh}</div>
                  <div className="text-xs text-white/50">{loc.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date Selector */}
      <div className="mb-4">
        <label className="text-white/70 text-xs font-medium mb-1 block flex items-center gap-1">
          <Calendar size={12} /> 取餐日期（僅限平日）
        </label>
        <div className="relative">
          <button
            onClick={() => { setDateOpen(!dateOpen); setLocationOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
              selectedDate
                ? 'bg-green-500/20 border border-green-400/50 text-white'
                : 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15'
            )}
          >
            <span>
              {selectedDate
                ? format(selectedDate, 'yyyy/MM/dd (EEE)', { locale: zhTW })
                : '選擇日期'}
            </span>
            <ChevronDown size={16} className={cn('transition-transform', dateOpen && 'rotate-180')} />
          </button>
          {dateOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900/95 backdrop-blur border border-white/20 rounded-xl overflow-y-auto max-h-48 z-50 shadow-2xl">
              {availableDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => { onSelectDate(date); setDateOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10',
                    selectedDate?.toDateString() === date.toDateString()
                      ? 'text-green-400 bg-green-500/10'
                      : 'text-white/80'
                  )}
                >
                  {format(date, 'yyyy/MM/dd (EEE)', { locale: zhTW })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={!selectedLocation || !selectedDate}
        className={cn(
          'w-full py-3 rounded-xl font-bold text-sm transition-all',
          selectedLocation && selectedDate
            ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25 hover:scale-[1.02]'
            : 'bg-white/10 text-white/40 cursor-not-allowed'
        )}
      >
        查看餐廳 →
      </button>
    </div>
  )
}
