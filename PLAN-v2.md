# Xinyi Lunch Pre-Ordering Platform — Revised Plan (v2)

## Summary
Rebuild the platform as a **Hono + Vite + React + TypeScript** full-stack app running on **Cloudflare Workers**, using **D1** as the source of truth. Google Sheets remains the restaurant/admin operations interface. LINE Login for identity, LINE Flex Messages for updates.

> **Migration rationale**: The current Next.js + OpenNext stack works but adds unnecessary complexity for a predominantly client-rendered CRUD app. Hono provides a lighter, type-safe API layer; Vite gives faster dev/build; React Router handles client routing. D1 replaces the current Sheets-only backend to solve durability, queryability, and rate-limit issues.

---

## Key Changes from v1

| Layer | v1 (Current) | v2 (Target) |
|---|---|---|
| Framework | Next.js 15 + OpenNext | Hono API + Vite React SPA |
| Database | Google Sheets only | Cloudflare D1 primary, Sheets secondary |
| Auth | JWT cookie (jose) | Same JWT cookie pattern, ported to Hono |
| Queue | None (inline) | Cloudflare Queues for side effects |
| Deployment | OpenNext → Cloudflare Pages | `wrangler dev` / `wrangler deploy` |
| Menu source | Restaurant Sheet `Menu` tab | Cached in D1; Sheet is the admin input |

---

## Data Architecture

### D1 is authoritative for:
- Order state, history, and items
- Customer identity (LINE user ID, profile)
- Coupon redemption counts and per-user limits
- Menu item cache (prices, categories, availability)
- Building/office location registry
- Restaurant metadata and availability rules
- Notification audit log
- Sheet sync event log

### Google Sheets are operational interfaces for:
- **Platform admin sheet** (`Settings`, `Buildings`, `Restaurants`, `Coupons`): system configuration.
- **Restaurant-owned sheets**: `Menu` (admin input), daily order tabs (auto-populated from D1).

### Sync directions
```
Sheet ──► D1          Settings, Buildings, Restaurants, Coupons, Menu items
D1  ──► Sheet         Daily orders (append), OrdersLog (append)
Sheet ──► D1 (webhook) Status changes from staff edits
```

**Critical rule**: `POST /api/orders` validates prices against D1 `menu_items`, not Sheets. A background sync job pulls menu changes from Sheets into D1 every 5 minutes (or on-demand via admin API).

---

## D1 Schema

```sql
-- Buildings / office locations
CREATE TABLE buildings (
  id TEXT PRIMARY KEY,           -- e.g. 'taipei-101'
  name_zh TEXT NOT NULL,
  name TEXT,
  lat REAL,
  lng REAL,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_buildings_active ON buildings(active);

-- Restaurants
CREATE TABLE restaurants (
  slug TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  banner_path TEXT,
  logo_path TEXT,
  tagline TEXT,
  cutoff_hour INTEGER DEFAULT 21,   -- display-only; shows customer when pre-order closes (no hard booking cutoff enforced)
  min_order INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 0,
  spreadsheet_id TEXT,              -- restaurant-owned sheet
  api_key TEXT,                     -- HMAC secret for webhooks
  active INTEGER DEFAULT 1,
  location_ids TEXT,                -- JSON array of building IDs
  available_days TEXT,              -- JSON array [1,2,3,4,5]
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_restaurants_active ON restaurants(active);

-- Menu items (cached from restaurant sheets)
CREATE TABLE menu_items (
  id TEXT NOT NULL,
  restaurant_slug TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bento','drink','side')),
  image_path TEXT,
  sort_order INTEGER DEFAULT 99,
  available INTEGER DEFAULT 1,
  sheet_synced_at DATETIME,
  PRIMARY KEY (restaurant_slug, id),
  FOREIGN KEY (restaurant_slug) REFERENCES restaurants(slug)
);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_slug, available);

-- Users (LINE identity)
CREATE TABLE users (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  language TEXT DEFAULT 'zh-TW',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coupons
CREATE TABLE coupons (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value INTEGER NOT NULL,
  min_order INTEGER DEFAULT 0,
  max_discount INTEGER,             -- cap for percent coupons
  max_uses INTEGER DEFAULT 999999,
  max_uses_per_user INTEGER DEFAULT 1,
  start_date TEXT,                  -- ISO date
  end_date TEXT,
  active INTEGER DEFAULT 1
);

-- Coupon redemptions
CREATE TABLE coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_code TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_code) REFERENCES coupons(code),
  UNIQUE (coupon_code, line_user_id, order_number)
);
CREATE INDEX idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);
CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions(line_user_id);

-- Orders
CREATE TABLE orders (
  order_number TEXT PRIMARY KEY,    -- e.g. SIAM-20260115-A1B2
  restaurant_slug TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  building_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL,      -- yyyy-MM-dd
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','ready','paid','cancelled')),
  subtotal INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  coupon_code TEXT,
  customer_name TEXT,
  company TEXT,
  phone TEXT,
  special_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_slug) REFERENCES restaurants(slug),
  FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
);
CREATE INDEX idx_orders_user ON orders(line_user_id, created_at DESC);
CREATE INDEX idx_orders_restaurant_date ON orders(restaurant_slug, delivery_date);
CREATE INDEX idx_orders_number ON orders(order_number);

-- Order items
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  category TEXT NOT NULL,
  FOREIGN KEY (order_number) REFERENCES orders(order_number)
);
CREATE INDEX idx_order_items_order ON order_items(order_number);

-- Sheet sync events (audit + retry tracking)
CREATE TABLE sheet_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('restaurant_daily','master_log')),
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
  attempts INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sheet_sync_order ON sheet_sync_events(order_number, target);

-- Notification logs (idempotency + audit)
CREATE TABLE notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'line_platform', -- or 'line_restaurant'
  message_id TEXT,
  error TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_order ON notification_logs(order_number);
```

---

## API Design (Hono)

### Public routes
| Method | Route | Description |
|---|---|---|
| GET | `/` | React SPA entry (served by Vite static build) |
| GET | `/:slug` | Restaurant page |
| GET | `/orders` | My orders history |
| GET | `/login/line` | Redirect to LINE OAuth |
| GET | `/auth/line/callback` | LINE callback → create user → set cookie |

### API routes
| Method | Route | Auth |
|---|---|---|
| GET | `/api/bootstrap` | Public — returns buildings + active restaurants + available dates |
| GET | `/api/restaurants?buildingId=&date=` | Public — filter by building and weekday |
| GET | `/api/restaurants/:slug/menu` | Public — D1 cached menu |
| POST | `/api/orders` | Cookie — validate → write D1 → enqueue side effects |
| GET | `/api/orders` | Cookie — list my orders |
| GET | `/api/orders/:orderNumber` | Cookie — order detail |
| POST | `/api/coupons/validate` | Public — validate code + return discount |
| POST | `/api/webhooks/sheet-status` | HMAC — staff status change from Apps Script |
| POST | `/api/admin/sync-sheets` | Admin key — trigger manual sync |
| POST | `/api/queue/sheet-side-effects` | Queue consumer — write to Sheets |
| POST | `/api/queue/line-notify` | Queue consumer — send Flex message |

### Queue message types
```ts
interface SheetSideEffectMessage {
  type: 'append_restaurant_daily' | 'append_master_log' | 'update_status'
  orderNumber: string
  attempt: number
}

interface LineNotifyMessage {
  type: 'order_status'
  orderNumber: string
  lineUserId: string
  status: string
  attempt: number
}
```

---

## Order Creation Flow (`POST /api/orders`)

1. **Validate session** — JWT cookie → `line_user_id`.
2. **Validate business rules**:
   - `deliveryDate` is a weekday.
   - If `deliveryDate === today`, reject if server time ≥ 09:00 Asia/Taipei.
   - `restaurant.available_days` includes delivery date's weekday.
   - `restaurant.location_ids` includes requested building.
   - Menu items exist in D1 and match server prices.
   - Subtotal ≥ `restaurant.min_order`.
3. **Validate coupon** (if provided):
   - Exists, active, not expired.
   - `subtotal ≥ coupon.min_order`.
   - Global redemption count < `coupon.max_uses`.
   - Per-user redemption count < `coupon.max_uses_per_user`.
   - Calculate discount (fixed or percent, capped).
4. **Write D1 atomically**:
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO orders (...);
   INSERT INTO order_items (...);
   INSERT INTO coupon_redemptions (...); -- if coupon
   COMMIT;
   ```
5. **Enqueue side effects**:
   - Send `SheetSideEffectMessage` to queue.
   - Send `LineNotifyMessage` to queue.
6. **Return** `{ orderNumber, total, status: 'pending' }`.

> **D1 transaction note**: D1 supports explicit transactions. If the insert fails, rollback and return 500. Do NOT retry inside the request — rely on client retry.

---

## Date & Cutoff Validation (Server-Side)

```ts
function isOrderAcceptable(
  deliveryDate: string,        // yyyy-MM-dd
  now: Date = new Date()
): boolean {
  const tz = 'Asia/Taipei'
  const today = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const currentHour = parseInt(formatInTimeZone(now, tz, 'H'))

  // Same-day: only before 09:00
  if (deliveryDate === today) {
    return currentHour < 9
  }

  // Future dates: accept if tomorrow through next 30 weekdays
  const maxDate = formatInTimeZone(addDays(now, 30), tz, 'yyyy-MM-dd')
  return deliveryDate > today && deliveryDate <= maxDate && isWeekday(deliveryDate)
}
```

---

## Sheets ↔ D1 Sync

### Menu sync (Sheet → D1)
- **Trigger**: Cron every 5 minutes, or `/api/admin/sync-sheets`.
- **Action**: Read `Menu!A2:H` from each restaurant sheet → upsert into `menu_items`.
- **Conflict**: Sheet wins. Set `sheet_synced_at = now()`.

### Order sync (D1 → Sheet)
- **Trigger**: Queue consumer.
- **Action**: Append order to restaurant's daily tab + master `OrdersLog`.
- **Idempotency**: Check `sheet_sync_events` — if `status = 'success'`, skip.

### Status sync (Sheet → D1)
- **Trigger**: Apps Script `onEdit` → POST `/api/webhooks/sheet-status`.
- **Validation**: HMAC-SHA256 with restaurant `api_key`.
- **Action**: Update `orders.status` in D1, then enqueue LINE notify.
- **Idempotency**: Accept same status multiple times (no-op if unchanged).

---

## Queue Consumers

### `sheet-side-effects` consumer
```ts
export default {
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      const body = msg.body as SheetSideEffectMessage
      const event = await getSyncEvent(body.orderNumber, body.type)
      if (event?.status === 'success') { msg.ack(); continue }

      try {
        await writeToSheet(body)
        await markSyncSuccess(body.orderNumber, body.type)
        msg.ack()
      } catch (err) {
        if (body.attempt >= 3) {
          await markSyncFailed(body.orderNumber, body.type, err)
          msg.ack() // dead letter
        } else {
          msg.retry({ delaySeconds: 30 })
        }
      }
    }
  }
}
```

### `line-notify` consumer
Same pattern — check `notification_logs` before sending, retry 3×, log failure.

---

## Auth (LINE Login)

Same JWT cookie pattern as v1, ported to Hono:

```ts
// Hono middleware
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, 'lunch_session')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const session = await verifySession(token, c.env.SESSION_SECRET)
  c.set('session', session)
  await next()
})
```

---

## Deployment

```bash
# Local dev
npm run dev          # Vite dev server + wrangler dev (D1 local)

# D1 migrations
npx wrangler d1 migrations create lunch-db "init"
npx wrangler d1 migrations apply lunch-db --local
npx wrangler d1 migrations apply lunch-db --remote

# Deploy
npm run build        # Vite build → dist/
npx wrangler deploy  # Deploy Worker + static assets
```

---

## Test Plan

### Unit tests (Vitest)
- Date validation: today before 09:00, future weekdays within 30 days.
- Coupon validation: expiry, min_order, global limit, per-user limit, percent cap.
- Order total calculation from server-side menu prices.
- HMAC webhook signature verification.

### Integration tests (Miniflare / wrangler unstable_dev)
- D1 migrations apply cleanly.
- `POST /api/orders` writes order + items in a transaction.
- Coupon redemption prevents duplicate use in concurrent requests.
- Queue consumer is idempotent (same message processed twice = 1 Sheet row).

### E2E tests (Playwright)
- Mobile map → building select → date select → restaurant list.
- Menu page → add to cart → apply coupon → checkout → submit → success.
- Order history shows submitted orders.
- Sheet status edit → webhook → status update visible in UI.

### Manual tests
- Google Apps Script `onEdit` → webhook → LINE Flex message received.
- D1 → Sheet sync visible in restaurant daily tab.

---

## Assumptions & Constraints

- v1 is Taiwan-only: `zh-TW`, `TWD`, `Asia/Taipei`.
- Payment is pay-at-pickup only.
- D1 query timeout: ~500ms. Keep queries simple; avoid N+1 (use JOINs or batched IN queries).
- D1 has eventual consistency on writes. If read-after-write is needed within the same request, use the result from the INSERT/UPDATE statement directly.
- Sheets API quota: ~300 writes/minute. Queue consumers must rate-limit or retry on 429.
- LINE Messaging API push: free tier has monthly limits. Log every attempt in `notification_logs`.

---

## Open Questions (Decide Before Build)

1. **Stack**: Confirm Hono+Vite vs staying on Next.js + swapping backend to D1. Hono is lighter; Next.js preserves existing UI components.
2. **Menu sync frequency**: 5-minute cron acceptable, or should edits be near-real-time?
3. **Order numbering**: Keep `SIAM-YYYYMMDD-XXXX` format? D1 can generate `XXXX` via `COUNT(*)` + 1 per day per restaurant, but race conditions exist. Consider `nanoid(6)` suffix instead.
4. **Cancellation**: Who can cancel — customer, staff, both? Refund policy?
5. **Admin UI**: Is `/api/admin/sync-sheets` enough, or do we need a web admin panel?
