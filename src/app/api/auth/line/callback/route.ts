import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getLineProfile } from '@/lib/line/auth'
import { signSession } from '@/lib/auth'
import { upsertMember } from '@/lib/google/registry'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('line_oauth_state')?.value
  const redirectAfter = req.cookies.get('line_redirect_after')?.value ?? '/'

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
  }

  try {
    const accessToken = await exchangeCodeForToken(code)
    const profile = await getLineProfile(accessToken)

    const sessionPayload = {
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
      memberId: profile.userId,
    }

    // Upsert member to Master Sheet (best-effort, non-blocking)
    upsertMember(profile).catch((err) => {
      console.error('Failed to upsert member to sheet:', err)
    })

    const token = await signSession(sessionPayload)

    const response = NextResponse.redirect(new URL(redirectAfter, req.url))
    const cookieOpts = {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax' as const,
      path: '/',
    }
    response.cookies.set('lunch_session', token, cookieOpts)
    response.cookies.delete('line_oauth_state')
    response.cookies.delete('line_oauth_nonce')
    response.cookies.delete('line_redirect_after')
    return response
  } catch (e) {
    console.error('LINE callback error:', e)
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
  }
}
