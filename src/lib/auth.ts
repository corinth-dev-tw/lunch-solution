import { SignJWT, jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET || process.env.LINE_LOGIN_CHANNEL_SECRET
  if (!raw) {
    throw new Error('SESSION_SECRET or LINE_LOGIN_CHANNEL_SECRET must be set')
  }
  return new TextEncoder().encode(raw)
}

export async function signSession(payload: Record<string, unknown>): Promise<string> {
  const secret = getSecret()
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifySession(token: string): Promise<Record<string, unknown>> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret, {
    clockTolerance: 60,
    maxTokenAge: '30d',
  })
  return payload
}
