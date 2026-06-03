import { NextResponse } from 'next/server'
import { getLocations } from '@/lib/google/registry'

export async function GET() {
  const locations = await getLocations()
  return NextResponse.json(
    { locations },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
  )
}
