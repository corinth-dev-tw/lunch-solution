/**
 * Debug endpoint: inspect the current session cookie.
 *
 * GET /api/test/session-debug
 *
 * Requires ENABLE_DEBUG_ENDPOINTS=true in env vars.
 * Never enable in production — leaks session payload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

const DISABLED = NextResponse.json({ error: 'Not found' }, { status: 404 })

export async function GET(req: NextRequest) {
  if (process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') return DISABLED

  const token = req.cookies.get('lunch_session')?.value
  if (!token) {
    return NextResponse.json({ session: null, error: 'No lunch_session cookie' }, { status: 401 })
  }

  try {
    const payload = await verifySession(token)
    return NextResponse.json({
      session: {
        lineUserId: payload.lineUserId,
        displayName: payload.displayName,
        pictureUrl: payload.pictureUrl,
        memberId: payload.memberId,
      },
      raw: payload,
      cookiePresent: true,
      cookiePreview: token.slice(0, 40) + '...',
    })
  } catch (e) {
    return NextResponse.json(
      { session: null, error: 'Invalid or expired token', detail: e instanceof Error ? e.message : String(e) },
      { status: 401 }
    )
  }
}
