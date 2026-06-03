import crypto from 'crypto'
import { LineProfile } from '@/types'
import { b64uDecode } from '@/lib/b64url'

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function buildLineAuthUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
    redirect_uri: process.env.LINE_LOGIN_CALLBACK_URL!,
    state,
    scope: 'profile openid email',
    nonce,
  })
  return `${LINE_AUTH_URL}?${params.toString()}`
}

export interface LineTokens {
  access_token: string
  id_token?: string
}

export async function exchangeCodeForToken(code: string): Promise<LineTokens> {
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINE_LOGIN_CALLBACK_URL!,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
    }),
  })
  if (!res.ok) throw new Error('Failed to exchange LINE code for token')
  const data = await res.json()
  return { access_token: data.access_token as string, id_token: data.id_token as string | undefined }
}

export function extractNonceFromIdToken(idToken: string): string | null {
  try {
    const payloadB64 = idToken.split('.')[1]
    const decoded = JSON.parse(new TextDecoder().decode(b64uDecode(payloadB64)))
    return typeof decoded.nonce === 'string' ? decoded.nonce : null
  } catch {
    return null
  }
}

export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch LINE profile')
  const data = await res.json()
  return {
    userId: data.userId,
    displayName: data.displayName,
    pictureUrl: data.pictureUrl,
  }
}

export async function verifyLineToken(accessToken: string): Promise<boolean> {
  const res = await fetch(`${LINE_VERIFY_URL}?access_token=${accessToken}`)
  if (!res.ok) return false
  const data = await res.json()
  return data.client_id === process.env.LINE_LOGIN_CHANNEL_ID
}
