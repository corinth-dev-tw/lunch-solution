import { NextRequest, NextResponse } from 'next/server'
import { getRestaurants } from '@/lib/google/registry'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const locationId = searchParams.get('location')
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!locationId || !date) {
    return NextResponse.json({ error: 'location and date required' }, { status: 400 })
  }

  const dayOfWeek = new Date(date + 'T12:00:00').getDay() // 0=Sun

  try {
    const restaurants = await getRestaurants(locationId, dayOfWeek)
    return NextResponse.json({
      restaurants: restaurants.map((r) => ({
        id: r.slug,
        name: r.slug,
        name_zh: r.name_zh,
        description: r.tagline,
        image_url: r.banner_path,
        location_ids: r.location_ids,
        available_days: r.available_days,
        cutoff_hour: r.cutoff_hour,
        min_order: r.min_order,
        delivery_fee: r.delivery_fee,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (e) {
    console.error('Restaurants API error:', e)
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 })
  }
}
