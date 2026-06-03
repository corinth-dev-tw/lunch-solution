import { LineProfile } from '@/types'

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateState(): string {
  return randomHex(16)
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

export async function exchangeCodeForToken(code: string): Promise<string> {
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
  return data.access_token as string
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
