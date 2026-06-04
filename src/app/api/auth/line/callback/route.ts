import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getLineProfile, extractNonceFromIdToken } from '@/lib/line/auth'
import { signSession } from '@/lib/session'

function fail(req: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/?error=${code}`, req.url))
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('line_oauth_state')?.value
  const storedNonce = req.cookies.get('line_oauth_nonce')?.value
  const redirectAfter = req.cookies.get('line_redirect_after')?.value ?? '/'

  // State / CSRF check
  if (!code || !state || !storedState || state !== storedState) {
    return fail(req, 'state')
  }

  // Exchange code for tokens
  let access_token: string
  let id_token: string | undefined
  try {
    const tokens = await exchangeCodeForToken(code)
    access_token = tokens.access_token
    id_token = tokens.id_token
  } catch (e) {
    console.error('LINE token exchange failed:', e)
    return fail(req, 'token')
  }

  // Nonce verification (skip gracefully if id_token absent — LINE channel may not have OIDC enabled)
  if (storedNonce) {
    if (id_token) {
      const tokenNonce = extractNonceFromIdToken(id_token)
      if (tokenNonce !== storedNonce) {
        return fail(req, 'nonce')
      }
    } else {
      console.warn('LINE callback: id_token absent, skipping nonce check (enable OpenID Connect in LINE Developer Console for full protection)')
    }
  }

  // Fetch LINE profile
  let profile: Awaited<ReturnType<typeof getLineProfile>>
  try {
    profile = await getLineProfile(access_token)
  } catch (e) {
    console.error('LINE profile fetch failed:', e)
    return fail(req, 'profile')
  }

  // Sign session cookie
  let signed: string
  try {
    signed = await signSession({
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? undefined,
      memberId: profile.userId,
    })
  } catch (e) {
    console.error('Session signing failed (COOKIE_SECRET set?):', e)
    return fail(req, 'cfg')
  }

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
}
