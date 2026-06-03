import { cookies } from 'next/headers'
import { b64uEncode, b64uDecode } from './b64url'

export interface Session {
  memberId: string
  lineUserId: string
  displayName: string
  pictureUrl?: string
}

const COOKIE_NAME = 'lunch_session'

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.COOKIE_SECRET
  if (!secret) throw new Error('COOKIE_SECRET not configured')
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

// Throws if COOKIE_SECRET is missing — callers must handle the error
export async function signSession(session: Session): Promise<string> {
  const payload = b64uEncode(new TextEncoder().encode(JSON.stringify(session)))
  const key = await hmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${b64uEncode(new Uint8Array(sig))}`
}

export async function verifySession(raw: string): Promise<Session | null> {
  const dot = raw.lastIndexOf('.')
  if (dot === -1) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  try {
    const key = await hmacKey()
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64uDecode(sig).buffer as ArrayBuffer,
      new TextEncoder().encode(payload)
    )
    if (!valid) return null
    return JSON.parse(new TextDecoder().decode(b64uDecode(payload))) as Session
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null
  return verifySession(raw)
}
