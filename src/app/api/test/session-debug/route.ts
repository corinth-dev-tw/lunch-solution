/**
 * Debug endpoint: inspect the current session cookie.
 *
 * GET /api/test/session-debug
 *
 * Returns decoded JWT payload or 401 if no valid session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('lunch_session')?.value
  if (!token) {
    return NextResponse.json(
      { session: null, error: 'No lunch_session cookie found' },
      { status: 401 }
    )
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
      {
        session: null,
        error: 'Invalid or expired token',
        detail: e instanceof Error ? e.message : String(e),
        cookiePresent: true,
        cookiePreview: token.slice(0, 40) + '...',
      },
      { status: 401 }
    )
  }
}
