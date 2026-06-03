import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export interface Session {
  memberId: string
  lineUserId: string
  displayName: string
  pictureUrl?: string
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('lunch_session')?.value
  if (!token) return null
  try {
    const payload = await verifySession(token)
    return {
      memberId: payload.memberId as string,
      lineUserId: payload.lineUserId as string,
      displayName: payload.displayName as string,
      pictureUrl: payload.pictureUrl as string | undefined,
    }
  } catch {
    return null
  }
}
