import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const locationId = searchParams.get('location')
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!locationId || !date) {
    return NextResponse.json({ error: 'location and date required' }, { status: 400 })
  }

  const dayOfWeek = new Date(date + 'T12:00:00').getDay() // 0=Sun

  let supabase
  try {
    supabase = await createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('active', true)
    .contains('location_ids', [locationId])
    .contains('available_days', [dayOfWeek])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ restaurants: data ?? [] })
}
