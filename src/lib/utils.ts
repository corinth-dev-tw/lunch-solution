import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { addDays, format, isBefore, startOfDay } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvailableDates(): Date[] {
  const today = startOfDay(new Date())
  const dates: Date[] = []
  for (let i = 1; i <= 30; i++) {
    const d = addDays(today, i)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) dates.push(d) // weekdays only
  }
  return dates
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
