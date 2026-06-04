export interface Env {
  DB: D1Database
  CACHE: KVNamespace
  ORDER_QUEUE: Queue<QueueMsg>
  ASSETS: Fetcher

  // Secrets (set via wrangler secret put or Cloudflare dashboard)
  SESSION_SECRET: string
  LINE_LOGIN_CHANNEL_ID: string
  LINE_LOGIN_CHANNEL_SECRET: string
  LINE_LOGIN_CALLBACK_URL: string
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string
  GOOGLE_SPREADSHEET_ID: string
  APP_URL: string
  RESTAURANT_API_KEY: string
}

// ── Queue message types ────────────────────────────────────────────────────

export type QueueMsg =
  | { type: 'sheet.append_order'; orderNumber: string }
  | { type: 'sheet.update_status'; orderNumber: string; status: string }
  | { type: 'line.push_status'; lineUserId: string; orderNumber: string; status: string; lineToken?: string }
