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
}

export default function LocationDatePicker({
  selectedLocation,
  selectedDate,
  onSelectLocation,
  onSelectDate,
  onConfirm,
}: LocationDatePickerProps) {
  const [locationOpen, setLocationOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const availableDates = getAvailableDates()

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl w-full max-w-sm">
      <h2 className="text-gray-900 font-bold text-lg mb-4 text-center">預訂午餐便當</h2>

      {/* Location Selector */}
      <div className="mb-3">
        <label className="text-gray-500 text-xs font-medium mb-1 block flex items-center gap-1">
          <MapPin size={12} /> 取餐地點
        </label>
        <div className="relative">
          <button
            onClick={() => { setLocationOpen(!locationOpen); setDateOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
              selectedLocation
                ? 'bg-amber-50 border border-amber-400 text-gray-900'
                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
            )}
          >
            <span>{selectedLocation ? selectedLocation.name_zh : '選擇辦公大樓'}</span>
            <ChevronDown size={16} className={cn('transition-transform', locationOpen && 'rotate-180')} />
          </button>
          {locationOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden z-50 shadow-xl">
              {XINYI_LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => { onSelectLocation(loc); setLocationOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-amber-50',
                    selectedLocation?.id === loc.id ? 'text-amber-600 bg-amber-50' : 'text-gray-700'
                  )}
                >
                  <div className="font-medium">{loc.name_zh}</div>
                  <div className="text-xs text-gray-400">{loc.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date Selector */}
      <div className="mb-4">
        <label className="text-gray-500 text-xs font-medium mb-1 block flex items-center gap-1">
          <Calendar size={12} /> 取餐日期（僅限平日）
        </label>
        <div className="relative">
          <button
            onClick={() => { setDateOpen(!dateOpen); setLocationOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
              selectedDate
                ? 'bg-amber-50 border border-amber-400 text-gray-900'
                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
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
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl overflow-y-auto max-h-48 z-50 shadow-xl">
              {availableDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => { onSelectDate(date); setDateOpen(false) }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-amber-50',
                    selectedDate?.toDateString() === date.toDateString()
                      ? 'text-amber-600 bg-amber-50 font-medium'
                      : 'text-gray-700'
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
            ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/25 hover:scale-[1.02]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        查看餐廳
      </button>
    </div>
  )
}
