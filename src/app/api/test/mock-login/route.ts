/**
 * Dev-only mock login endpoint.
 * Bypasses real LINE OAuth and creates a signed session cookie directly.
 *
 * GET /api/test/mock-login?redirect=/my-orders
 *
 * ⚠️ ONLY FOR LOCAL DEVELOPMENT. Do not use in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { signSession } from '@/lib/auth'
import { upsertMember } from '@/lib/google/registry'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/my-orders'

  const mockProfile = {
    lineUserId: 'U_dev_test_001',
    displayName: '測試使用者',
    pictureUrl: 'https://placehold.co/200x200/1DB954/ffffff?text=Test',
    memberId: 'U_dev_test_001',
  }

  // Upsert to D1 (dev fallback)
  upsertMember({
    userId: mockProfile.lineUserId,
    displayName: mockProfile.displayName,
    pictureUrl: mockProfile.pictureUrl,
    language: 'zh-TW',
  }).catch(console.error)

  const token = await signSession(mockProfile)

  const response = NextResponse.redirect(new URL(redirect, req.url))
  const cookieOpts = {
    httpOnly: true,
    secure: false, // allow http localhost
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax' as const,
    path: '/',
  }
  response.cookies.set('lunch_session', token, cookieOpts)
  return response
}
