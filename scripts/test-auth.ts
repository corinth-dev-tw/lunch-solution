/**
 * Test script: verify JWT session signing/verification works.
 *
 * Run:
 *   npx tsx scripts/test-auth.ts
 *
 * This tests the auth stack without calling real LINE APIs.
 */

import { signSession, verifySession } from '../src/lib/auth'

async function test() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Auth Stack Test — JWT Sign / Verify / Session')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  // Ensure secret is available
  const secret = process.env.SESSION_SECRET || process.env.LINE_LOGIN_CHANNEL_SECRET
  if (!secret) {
    console.error('❌ SESSION_SECRET or LINE_LOGIN_CHANNEL_SECRET must be set')
    console.error('   Add it to .env.local and run: source .env.local && npx tsx scripts/test-auth.ts')
    process.exit(1)
  }

  // 1. Sign a session
  const payload = {
    lineUserId: 'U1234567890abcdef',
    displayName: 'Test User',
    pictureUrl: 'https://example.com/photo.jpg',
    memberId: 'U1234567890abcdef',
  }

  console.log('1. Signing session payload:')
  console.log('   ', JSON.stringify(payload))

  let token: string
  try {
    token = await signSession(payload)
    console.log('   ✅ Token signed successfully')
    console.log('   Token length:', token.length)
    console.log('   Token preview:', token.slice(0, 60) + '...')
  } catch (e) {
    console.error('   ❌ Sign failed:', e)
    process.exit(1)
  }

  console.log()

  // 2. Verify the session
  console.log('2. Verifying session token...')
  let decoded: Record<string, unknown>
  try {
    decoded = await verifySession(token)
    console.log('   ✅ Token verified successfully')
    console.log('   Decoded payload:')
    Object.entries(decoded).forEach(([k, v]) => {
      if (k !== 'iat' && k !== 'exp') {
        console.log(`      ${k}: ${v}`)
      }
    })
    console.log('      iat:', new Date((decoded.iat as number) * 1000).toISOString())
    console.log('      exp:', new Date((decoded.exp as number) * 1000).toISOString())
  } catch (e) {
    console.error('   ❌ Verify failed:', e)
    process.exit(1)
  }

  console.log()

  // 3. Check payload integrity
  console.log('3. Checking payload integrity...')
  const checks = [
    ['lineUserId matches', decoded.lineUserId === payload.lineUserId],
    ['displayName matches', decoded.displayName === payload.displayName],
    ['memberId matches', decoded.memberId === payload.memberId],
    ['pictureUrl matches', decoded.pictureUrl === payload.pictureUrl],
    ['has issued-at (iat)', typeof decoded.iat === 'number'],
    ['has expiration (exp)', typeof decoded.exp === 'number'],
  ]

  let allPassed = true
  for (const [label, passed] of checks) {
    const icon = passed ? '✅' : '❌'
    console.log(`   ${icon} ${label}`)
    if (!passed) allPassed = false
  }

  console.log()

  // 4. Simulate tampered token
  console.log('4. Testing tampered token rejection...')
  const tampered = token.slice(0, -5) + 'xxxxx'
  try {
    await verifySession(tampered)
    console.log('   ❌ Tampered token was accepted (should have been rejected)')
    allPassed = false
  } catch {
    console.log('   ✅ Tampered token correctly rejected')
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════════')
  console.log(allPassed ? '✅ All auth tests passed' : '❌ Some tests failed')
  console.log('═══════════════════════════════════════════════════════════')
}

test()
