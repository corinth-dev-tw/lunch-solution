/**
 * Validate LINE Login & Messaging configuration.
 *
 * Run:
 *   source .env.local && npx tsx scripts/test-line-config.ts
 */

import { buildLineAuthUrl, generateState } from '../src/lib/line/auth'

function check(label: string, value: string | undefined, minLen = 1): boolean {
  const ok = !!value && value.length >= minLen && !value.includes('your_')
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}: missing or placeholder`)
  return ok
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('LINE Configuration Validator')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  const env = process.env
  let ok = true

  console.log('1. LINE Login Channel')
  ok = check('LINE_LOGIN_CHANNEL_ID', env.LINE_LOGIN_CHANNEL_ID, 5) && ok
  ok = check('LINE_LOGIN_CHANNEL_SECRET', env.LINE_LOGIN_CHANNEL_SECRET, 10) && ok
  ok = check('LINE_LOGIN_CALLBACK_URL', env.LINE_LOGIN_CALLBACK_URL, 10) && ok

  if (env.LINE_LOGIN_CALLBACK_URL) {
    const isLocalhost = env.LINE_LOGIN_CALLBACK_URL.includes('localhost')
    const isDev = isLocalhost || env.LINE_LOGIN_CALLBACK_URL.includes('127.0.0.1')
    if (isDev) {
      console.log('   ℹ️  Callback URL is set to localhost (dev mode)')
    } else {
      console.log('   ⚠️  Callback URL is set to PRODUCTION:')
      console.log('      ', env.LINE_LOGIN_CALLBACK_URL)
      console.log('      Real LINE login on localhost will FAIL unless you also add')
      console.log('      http://localhost:3000/api/auth/line/callback in LINE Console.')
    }
  }

  console.log()
  console.log('2. LINE Messaging API')
  ok = check('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN', env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN, 10) && ok

  if (env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.includes('your_line')) {
    console.log('   ❌ TOKEN is still a placeholder')
    ok = false
  }

  console.log()
  console.log('3. Generated Auth URL (for inspection)')
  try {
    const state = generateState()
    const nonce = generateState()
    const url = buildLineAuthUrl(state, nonce)
    console.log('   ✅ Auth URL generated successfully')
    console.log('   URL preview:', url.slice(0, 120) + '...')
    const parsed = new URL(url)
    console.log('   client_id:', parsed.searchParams.get('client_id'))
    console.log('   redirect_uri:', parsed.searchParams.get('redirect_uri'))
    console.log('   scope:', parsed.searchParams.get('scope'))
  } catch (e) {
    console.log('   ❌ Failed to build auth URL:', e)
    ok = false
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════════')
  if (ok) {
    console.log('✅ LINE config looks good')
  } else {
    console.log('❌ Some LINE config values are missing or invalid')
    console.log('   Check .env.local and LINE Developers Console.')
  }
  console.log('═══════════════════════════════════════════════════════════')
}

main()
