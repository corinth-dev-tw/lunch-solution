# 信義午餐 — Setup Guide

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Mapbox](https://mapbox.com) account (free tier works)
- LINE Developer account (LINE Login + Messaging API channels)
- A Google Cloud service account with Sheets API enabled

---

## 1. Supabase

1. Create a new Supabase project
2. Go to **SQL Editor** → paste and run `src/lib/supabase/schema.sql`
3. Run `src/lib/supabase/seed.sql` to add sample restaurants, menu items, and coupons
4. Copy your **Project URL** and **anon key** from Project Settings → API

### RLS note
The schema enables Row Level Security. For MVP, add a service-role bypass policy or use the service key (already wired in API routes via `createServiceClient`).

---

## 2. Mapbox

1. Sign up at mapbox.com → copy your **Default public token**
2. Paste it as `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`

---

## 3. LINE Login

1. Go to [LINE Developers Console](https://developers.line.biz)
2. Create a **LINE Login** channel
3. Under **LINE Login** → Callback URL, add:
   - `http://localhost:3000/api/auth/line/callback` (dev)
   - `https://yourdomain.com/api/auth/line/callback` (prod)
4. Copy **Channel ID** and **Channel Secret**

---

## 4. LINE Messaging API

1. Create a **Messaging API** channel in LINE Developers Console
2. Issue a **Long-lived Channel Access Token**
3. Paste it as `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
4. (Optional) Set up webhook URL for future inbound messages

---

## 5. Google Sheets

1. Create a new Google Sheet named **LunchOrders** with a sheet tab named `Orders`
2. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
3. Enable **Google Sheets API**
4. Create a **Service Account** → download JSON key
5. Share the spreadsheet with the service account email (Editor role)
6. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
7. Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
8. Copy the spreadsheet ID from the URL → `GOOGLE_SPREADSHEET_ID`

---

## 6. .env.local

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

LINE_LOGIN_CHANNEL_ID=1234567890
LINE_LOGIN_CHANNEL_SECRET=abc123...
LINE_LOGIN_CALLBACK_URL=http://localhost:3000/api/auth/line/callback

LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=xxx...

GOOGLE_SERVICE_ACCOUNT_EMAIL=lunch@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA...

NEXT_PUBLIC_APP_URL=http://localhost:3000
RESTAURANT_API_KEY=your_secret_key_for_restaurant_dashboard

# 32+ random bytes, base64 or hex — used to HMAC-sign session cookies
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
COOKIE_SECRET=your_32_byte_random_secret
```

---

## 7. Run

```bash
npm run dev
# open http://localhost:3000
```

---

## Architecture

```
Landing page (/)
  ├── 3D Mapbox map of Xinyi District
  ├── Click marker → select office building
  ├── Pick date (weekdays only, tomorrow → +30 days)
  └── See available restaurants → click → /order/[id]

Order page (/order/[restaurantId])
  ├── Browse bento menu
  ├── Add/remove items in cart
  ├── Apply coupon (validated server-side)
  ├── LINE Login gate (redirect + return)
  └── Submit → POST /api/orders

POST /api/orders
  ├── Creates order + order_items in Supabase
  ├── Fires LINE Flex Message push (non-blocking)
  └── Syncs row to Google Sheets (non-blocking)

PATCH /api/orders/[id]/status  (restaurant-facing, needs x-restaurant-key header)
  ├── Updates order status in Supabase
  ├── Pushes status-update LINE Flex Message to customer
  └── Updates Google Sheets row

My Orders (/my-orders)
  └── Lists user's orders with status badges
```

## Google Sheets columns

| Col | Content |
|-----|---------|
| A | 訂單編號 |
| B | 訂單狀態 |
| C | 取餐地點 |
| D | 取餐日期 |
| E | 會員名稱 |
| F | LINE ID |
| G | 餐廳 |
| H | 訂購內容 |
| I | 小計 |
| J | 折扣 |
| K | 運費 |
| L | 總計 |
| M | 優惠券 |
| N | 備註 |
| O | 建立時間 |

## Updating order status (for restaurants)

```bash
curl -X PATCH https://yourdomain.com/api/orders/{ORDER_ID}/status \
  -H "x-restaurant-key: your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing", "restaurantId": "siammore"}'
```

The `restaurantId` field is required and must match the order's restaurant — this prevents one restaurant from updating another's orders.

Status flow: `pending → confirmed → preparing → ready → delivered`
