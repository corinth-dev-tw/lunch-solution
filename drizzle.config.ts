import { defineConfig } from 'drizzle-kit'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const databaseId = process.env.D1_DATABASE_ID
const token = process.env.CLOUDFLARE_API_TOKEN

if (!accountId || !databaseId || !token) {
  const missing = [
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !databaseId && 'D1_DATABASE_ID',
    !token && 'CLOUDFLARE_API_TOKEN',
  ].filter(Boolean).join(', ')
  throw new Error(`drizzle.config.ts: missing required env vars: ${missing}`)
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: { accountId, databaseId, token },
})
