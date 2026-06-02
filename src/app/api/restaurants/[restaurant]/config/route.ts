import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantConfig, getMenuItems } from '@/lib/google/registry'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurant: string }> }
) {
  const { restaurant } = await params

  const [config, menu] = await Promise.all([
    getRestaurantConfig(restaurant),
    getMenuItems(restaurant),
  ])

  if (!config) {
    return NextResponse.json({ config: null, menu: [] }, { status: 404 })
  }

  // Strip spreadsheet_id from client response (internal detail)
  const { spreadsheet_id: _, ...safeConfig } = config

  return NextResponse.json(
    { config: safeConfig, menu },
    {
      headers: {
        // Cache for 1 hour in browser, 5 min at CDN edge
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }
  )
}
