import { NextRequest, NextResponse } from 'next/server'
import { getRestaurantConfig, getMenuItems, getMenuItemsFromSheet } from '@/lib/google/registry'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurant: string }> }
) {
  const { restaurant } = await params

  const config = await getRestaurantConfig(restaurant)
  if (!config) {
    return NextResponse.json({ config: null, menu: [] }, { status: 404 })
  }

  // Try restaurant's own sheet first; fall back to master MenuItems tab
  let menu = config.spreadsheet_id
    ? await getMenuItemsFromSheet(config.spreadsheet_id, restaurant)
    : null
  if (!menu || menu.length === 0) {
    menu = await getMenuItems(restaurant)
  }

  // Strip spreadsheet_id from client response (internal detail)
  const { spreadsheet_id: _, ...safeConfig } = config

  return NextResponse.json(
    { config: safeConfig, menu },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }
  )
}
