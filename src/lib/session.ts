import { cookies } from 'next/headers'

export interface Session {
  memberId: string
  lineUserId: string
  displayName: string
  pictureUrl?: string
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('lunch_session')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}
