import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantConfig, getMenuItems, DEV_MENU } from '@/lib/google/registry'
import type { MenuItemConfig } from '@/lib/google/registry'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurant: string }> }
) {
  const { restaurant } = await params

  const config = await getRestaurantConfig(restaurant)
  if (!config) {
    return NextResponse.json({ config: null, menu: [] }, { status: 404 })
  }

  let menu: MenuItemConfig[] = []
  try {
    menu = await getMenuItems(restaurant)
  } catch (e) {
    console.error('Failed to read menu from D1:', e)
    menu = DEV_MENU.filter((m) => m.restaurant_slug === restaurant && m.available)
  }

  // Strip internal fields from client response
  const { spreadsheet_id: _, line_channel_id: __, line_channel_secret: ___, line_channel_access_token: ____, ...safeConfig } = config

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
