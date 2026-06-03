
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const raw = req.cookies.get('lunch_session')?.value
  if (!raw) return NextResponse.json({ session: null }, { status: 401 })
  const session = await verifySession(raw)
  if (!session) return NextResponse.json({ session: null }, { status: 401 })
  return NextResponse.json({ session })
}
