import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { addDays, format, isBefore, startOfDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isBefore9amTaipei(): boolean {
  const now = new Date()
  const taipeiHour = parseInt(formatInTimeZone(now, 'Asia/Taipei', 'H'))
  return taipeiHour < 9
}

export function getAvailableDates(): Date[] {
  const today = startOfDay(new Date())
  const isBefore9am = isBefore9amTaipei()
  const startOffset = isBefore9am ? 0 : 1

  const dates: Date[] = []
  for (let i = startOffset; i <= 30; i++) {
    const d = addDays(today, i)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) dates.push(d) // weekdays only
  }
  return dates
}

export function getTodayTaipei(): string {
  return formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyy-MM-dd')
}

export function formatDateDisplay(date: Date): string {
  return format(date, 'yyyy/MM/dd (EEE)')
}

export function generateOrderNumber(): string {
  const now = new Date()
  const datePart = format(now, 'yyyyMMdd')
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `LN-${datePart}-${rand}`
}
