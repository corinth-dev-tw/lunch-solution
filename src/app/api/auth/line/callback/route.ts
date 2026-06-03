
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getLineProfile, extractNonceFromIdToken } from '@/lib/line/auth'
import { signSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('line_oauth_state')?.value
  const storedNonce = req.cookies.get('line_oauth_nonce')?.value
  const redirectAfter = req.cookies.get('line_redirect_after')?.value ?? '/'

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
  }

  try {
    const { access_token, id_token } = await exchangeCodeForToken(code)

    // Verify nonce to prevent replay attacks — fail hard if we can't check
    if (storedNonce) {
      if (!id_token) {
        return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
      }
      const tokenNonce = extractNonceFromIdToken(id_token)
      if (tokenNonce !== storedNonce) {
        return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
      }
    }

    const profile = await getLineProfile(access_token)

    const session = {
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? undefined,
      memberId: profile.userId,
    }

    const signed = await signSession(session)

    const response = NextResponse.redirect(new URL(redirectAfter, req.url))
    const cookieOpts = {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax' as const,
      path: '/',
    }
    response.cookies.set('lunch_session', signed, cookieOpts)
    response.cookies.delete('line_oauth_state')
    response.cookies.delete('line_oauth_nonce')
    response.cookies.delete('line_redirect_after')
    return response
  } catch (e) {
    console.error('LINE callback error:', e)
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url))
  }
}
