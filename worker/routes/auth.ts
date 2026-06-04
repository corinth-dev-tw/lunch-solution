import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../types'
import {
  buildLineAuthUrl, exchangeLineCode, getLineProfile,
  generateState, generateNonce, extractNonce, signSession,
} from '../services/auth'
import { upsertUser } from '../services/db'

const app = new Hono<{ Bindings: Env }>()

const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

app.get('/line', (c) => {
  const rawRedirect = c.req.query('redirect') ?? '/'
  const redirect = /^\/(?:[^/\\]|$)/.test(rawRedirect) ? rawRedirect : '/'
  const state = generateState()
  const nonce = generateNonce()

  const res = Response.redirect(buildLineAuthUrl(c.env, state, nonce), 307)
  // We can't set cookies on a plain Response — use Hono's response manipulation
  const honoRes = new Response(null, { status: 307, headers: res.headers })
  const url = buildLineAuthUrl(c.env, state, nonce)
  return c.redirect(url, 307)
  // Note: cookies set below via Response headers won't work with c.redirect.
  // We return a manual response instead.
})

// Rebuild the route properly
export default new Hono<{ Bindings: Env }>()

  .get('/line', async (c) => {
    const rawRedirect = c.req.query('redirect') ?? '/'
    const redirect = /^\/(?:[^/\\]|$)/.test(rawRedirect) ? rawRedirect : '/'
    const state = generateState()
    const nonce = generateNonce()

    const res = c.redirect(buildLineAuthUrl(c.env, state, nonce), 307)
    const cookieMaxAge = 300
    setCookie(c, 'line_oauth_state', state, { ...COOKIE_OPTS, maxAge: cookieMaxAge })
    setCookie(c, 'line_oauth_nonce', nonce, { ...COOKIE_OPTS, maxAge: cookieMaxAge })
    setCookie(c, 'line_redirect_after', redirect, { ...COOKIE_OPTS, maxAge: cookieMaxAge })
    return res
  })

  .get('/line/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const storedState = getCookie(c, 'line_oauth_state')
    const storedNonce = getCookie(c, 'line_oauth_nonce')
    const redirectAfter = getCookie(c, 'line_redirect_after') ?? '/'

    if (!code || !state || !storedState || state !== storedState) {
      return c.redirect('/?error=state', 307)
    }

    // Exchange code
    let tokens: { access_token: string; id_token?: string }
    try {
      tokens = await exchangeLineCode(c.env, code)
    } catch (e) {
      console.error('LINE token exchange:', e)
      return c.redirect('/?error=token', 307)
    }

    // Nonce check
    if (storedNonce) {
      if (!tokens.id_token) {
        console.warn('LINE callback: id_token absent, skipping nonce check')
      } else {
        const tokenNonce = extractNonce(tokens.id_token)
        if (tokenNonce !== storedNonce) return c.redirect('/?error=nonce', 307)
      }
    }

    // Fetch profile
    let profile: { userId: string; displayName: string; pictureUrl?: string }
    try {
      profile = await getLineProfile(tokens.access_token)
    } catch (e) {
      console.error('LINE profile fetch:', e)
      return c.redirect('/?error=profile', 307)
    }

    // Persist user
    await upsertUser(c.env.DB, profile.userId, profile.displayName, profile.pictureUrl)

    // Sign session
    let signed: string
    try {
      signed = await signSession(c.env, {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
      })
    } catch (e) {
      console.error('Session signing (SESSION_SECRET set?):', e)
      return c.redirect('/?error=cfg', 307)
    }

    // Set session cookie and clean up OAuth cookies
    const res = c.redirect(redirectAfter, 307)
    setCookie(c, 'lunch_session', signed, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 30 })
    deleteCookie(c, 'line_oauth_state')
    deleteCookie(c, 'line_oauth_nonce')
    deleteCookie(c, 'line_redirect_after')
    return res
  })

  .post('/logout', (c) => {
    deleteCookie(c, 'lunch_session')
    return c.json({ ok: true })
  })

  .get('/session', async (c) => {
    const token = getCookie(c, 'lunch_session')
    if (!token) return c.json({ session: null }, 401)
    try {
      const { jwtVerify } = await import('jose')
      const secret = new TextEncoder().encode(c.env.SESSION_SECRET)
      const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })
      return c.json({
        session: {
          lineUserId: payload.lineUserId,
          displayName: payload.displayName,
          pictureUrl: payload.pictureUrl,
        }
      })
    } catch {
      return c.json({ session: null }, 401)
    }
  })

  .get('/check', async (c) => {
    if (c.req.header('x-restaurant-key') !== c.env.RESTAURANT_API_KEY) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const vars = {
      SESSION_SECRET: c.env.SESSION_SECRET ? 'set' : 'MISSING',
      LINE_LOGIN_CHANNEL_ID: c.env.LINE_LOGIN_CHANNEL_ID ? 'set' : 'MISSING',
      LINE_LOGIN_CHANNEL_SECRET: c.env.LINE_LOGIN_CHANNEL_SECRET ? 'set' : 'MISSING',
      LINE_LOGIN_CALLBACK_URL: c.env.LINE_LOGIN_CALLBACK_URL ?? 'MISSING',
    }
    const ready = Object.values(vars).every((v) => v !== 'MISSING')
    return c.json({ ...vars, ready })
  })
