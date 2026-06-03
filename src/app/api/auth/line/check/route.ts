/**
 * Diagnostic endpoint — checks all LINE login env vars are present.
 * Protected by x-restaurant-key header.
 * Values are never returned; only presence is reported.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-restaurant-key') !== process.env.RESTAURANT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vars = {
    COOKIE_SECRET: process.env.COOKIE_SECRET ? 'set' : 'MISSING',
    LINE_LOGIN_CHANNEL_ID: process.env.LINE_LOGIN_CHANNEL_ID ? 'set' : 'MISSING',
    LINE_LOGIN_CHANNEL_SECRET: process.env.LINE_LOGIN_CHANNEL_SECRET ? 'set' : 'MISSING',
    LINE_LOGIN_CALLBACK_URL: process.env.LINE_LOGIN_CALLBACK_URL ?? 'MISSING',
  }

  const ready = Object.values(vars).every((v) => v !== 'MISSING')

  return NextResponse.json({ ...vars, ready })
}
