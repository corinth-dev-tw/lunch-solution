import { NextRequest, NextResponse } from 'next/server'
import { buildLineAuthUrl, generateState } from '@/lib/line/auth'

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/'
  const state = generateState()
  const nonce = generateState()

  const response = NextResponse.redirect(buildLineAuthUrl(state, nonce))
  const cookieOpts = { httpOnly: true, secure: true, maxAge: 300, sameSite: 'lax' as const, path: '/' }
  response.cookies.set('line_oauth_state', state, cookieOpts)
  response.cookies.set('line_oauth_nonce', nonce, cookieOpts)
  response.cookies.set('line_redirect_after', redirect, cookieOpts)
  return response
}
