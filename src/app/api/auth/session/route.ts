
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const raw = req.cookies.get('lunch_session')?.value
  if (!raw) return NextResponse.json({ session: null }, { status: 401 })
  try {
    return NextResponse.json({ session: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ session: null }, { status: 401 })
  }
}
