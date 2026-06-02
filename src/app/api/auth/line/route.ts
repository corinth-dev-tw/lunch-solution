
import { NextRequest, NextResponse } from 'next/server'
import { buildLineAuthUrl } from '@/lib/line/auth'

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/'
  const state = randomHex()
  const nonce = randomHex()

  const response = NextResponse.redirect(buildLineAuthUrl(state, nonce))
  const cookieOpts = { httpOnly: true, secure: true, maxAge: 300, sameSite: 'lax' as const, path: '/' }
  response.cookies.set('line_oauth_state', state, cookieOpts)
  response.cookies.set('line_oauth_nonce', nonce, cookieOpts)
  response.cookies.set('line_redirect_after', redirect, cookieOpts)
  return response
}
