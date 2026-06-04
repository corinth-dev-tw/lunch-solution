import { SignJWT } from 'jose'
import type { Env } from '../types'

function secret(env: Env) {
  const raw = env.SESSION_SECRET || env.LINE_LOGIN_CHANNEL_SECRET
  if (!raw) throw new Error('SESSION_SECRET not configured')
  return new TextEncoder().encode(raw)
}

export async function signSession(env: Env, payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret(env))
}

// ── LINE OAuth ─────────────────────────────────────────────────────────────

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile'

export function buildLineAuthUrl(env: Env, state: string, nonce: string): string {
  return `${LINE_AUTH_URL}?${new URLSearchParams({
    response_type: 'code',
    client_id: env.LINE_LOGIN_CHANNEL_ID,
    redirect_uri: env.LINE_LOGIN_CALLBACK_URL,
    state,
    scope: 'profile openid email',
    nonce,
  })}`
}

export async function exchangeLineCode(env: Env, code: string): Promise<{ access_token: string; id_token?: string }> {
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.LINE_LOGIN_CALLBACK_URL,
      client_id: env.LINE_LOGIN_CHANNEL_ID,
      client_secret: env.LINE_LOGIN_CHANNEL_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`LINE token exchange failed: ${res.status}`)
  return res.json()
}

export async function getLineProfile(accessToken: string): Promise<{ userId: string; displayName: string; pictureUrl?: string }> {
  const res = await fetch(LINE_PROFILE_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`LINE profile fetch failed: ${res.status}`)
  return res.json()
}

export function extractNonce(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1]
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - padded.length % 4) % 4
    const decoded = JSON.parse(atob(padded + '='.repeat(pad)))
    return typeof decoded.nonce === 'string' ? decoded.nonce : null
  } catch { return null }
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateState() { return randomHex() }
export function generateNonce() { return randomHex() }
