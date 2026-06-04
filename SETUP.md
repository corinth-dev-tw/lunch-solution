# 信義午餐 — Setup Guide

## Prerequisites

- Node.js 18+
- A [Mapbox](https://mapbox.com) account (free tier works)
- LINE Developer account (LINE Login + Messaging API channels)
- A Google Cloud service account with **Google Sheets API** enabled
- Cloudflare account (for D1 database + Workers/Pages deployment)

---

## 1. Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
2. Enable **Google Sheets API**
3. Create a **Service Account** → download JSON key
4. Copy values from the JSON key:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

---

## 2. Cloudflare D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → D1
2. Create a database named `lunch-db`
3. Run migrations:
   ```bash
   npx wrangler d1 execute lunch-db --local --file=./migrations/0001_init.sql
   npx wrangler d1 execute lunch-db --local --file=./migrations/0002_seed.sql
   npx wrangler d1 execute lunch-db --local --file=./migrations/0003_add_restaurant_line_creds.sql
   ```
4. For production:
   ```bash
   npx wrangler d1 execute lunch-db --remote --file=./migrations/0001_init.sql
   npx wrangler d1 execute lunch-db --remote --file=./migrations/0002_seed.sql
   npx wrangler d1 execute lunch-db --remote --file=./migrations/0003_add_restaurant_line_creds.sql
   ```

---

## 3. Create a Restaurant Order Sheet

For each restaurant (e.g. 饗泰多):

1. Go to [Google Sheets](https://sheets.google.com) → create a blank spreadsheet
2. Name it: **饗泰多 松高店 - 訂單**
3. Copy the spreadsheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Save this ID — you will insert it into the D1 `restaurants` table as `spreadsheet_id`
5. **Share the sheet** with:
   - Restaurant staff → **Editor** role
   - Your service account email → **Editor** role

### Required Tabs

Create these tabs inside the restaurant's sheet:

| Tab | Purpose |
|---|---|
| `Instruction` | How to use the sheet (for staff) |
| `Dashboard` | Formulas for today's stats |
| `Members` | Unique customers |
| `Promotions` | Active coupons |
| `Menu` | Menu items (see format below) |

> The platform creates **daily order tabs automatically** when the first order comes in. Daily tabs are named `yyyy-MM-dd` (e.g. `2026-06-03`).

### Menu Tab Format

Each restaurant's sheet must have a **`Menu`** tab with these columns:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| id | name_zh | description | price | category | image_path | sort_order | available |

**Header row (paste into A1):**
```
id	name_zh	description	price	category	image_path	sort_order	available
```

**Example rows (饗泰多 menu):**
```
qtan	Q彈好咖餐盒	Q彈脆口「酥炸松阪豬」+濃香滑順「黃金咖喱雞」	200	bento	/siammore/products/qtan-bento.jpg	1	TRUE
basil	開胃扒飯餐盒	經典白飯殺手「扒飯打拋豬」+酸甜開胃「泰式手撕雞涼拌」	200	bento	/siammore/products/basil-bento.jpg	2	TRUE
kacha	咔滋爆爽餐盒	酥脆多汁「咔滋椒麻雞」+鹹香下飯「蠔氣爆炒牛」	200	bento	/siammore/products/kacha-bento.jpg	3	TRUE
milk-tea	泰式奶茶	濃郁奶香，泰式經典	30	drink	/siammore/products/thai-milk-tea.jpg	4	TRUE
lemon	檸檬茶	清爽酸甜，消暑解膩	20	drink	/siammore/products/lemon-drink.jpg	5	TRUE
```

**`category` values:** `bento` | `drink` | `side`

### Daily Order Tab (Auto-Created)

When the first order of the day arrives, the platform automatically creates a new tab named with the date (e.g. `2026-06-03`). The tab has this header row:

| 訂單編號 | 時間 | 取餐日期 | 取餐地點 | 姓名 | 公司 | 電話 | LINE ID | 便當內容 | 便當數量 | 加購飲品 | 小計 | 優惠碼 | 折扣 | 應付金額 | 備註 | 狀態 | 推播 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

**Staff only edit column Q (狀態).** A dropdown is automatically applied with these options:
- `待確認` → `已確認` → `備餐中` → `可取餐` → `已付款` → `已取消`

Changing the status triggers the Google Apps Script (see step 4), which calls the webhook to update D1 and send a LINE notification to the customer.

---

## 4. Install Google Apps Script (Status Notifications)

For each restaurant sheet, install the Apps Script so staff status changes sync to D1 and trigger LINE pushes:

1. Open the restaurant's Google Sheet
2. **Extensions → Apps Script**
3. Delete the default `myFunction()` code
4. Paste the contents of [`scripts/google-apps-script.js`](./scripts/google-apps-script.js)
5. Replace `YOUR_RESTAURANT_API_KEY` with the restaurant's `api_key` from D1
6. Replace `YOUR_RESTAURANT_SLUG` with the restaurant slug
7. Save (Ctrl+S)
8. Click the **clock icon (Triggers)** on the left
9. Click **+ Add Trigger**
10. Choose function: `onEdit`
11. Choose event source: `From spreadsheet`
12. Choose event type: `On edit`
13. Click **Save**

> When staff changes the status in column Q, the script calls the webhook API, which updates D1 and sends a LINE Flex Message to the customer.

---

## 5. Mapbox

1. Sign up at [mapbox.com](https://mapbox.com) → copy your **Default public token**
2. Paste it as `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`

---

## 6. LINE Login

1. Go to [LINE Developers Console](https://developers.line.biz)
2. Create a **LINE Login** channel
3. Under **LINE Login** → Callback URL, add:
   - `http://localhost:3000/api/auth/line/callback` (dev)
   - `https://lunch.antu-technology.com/api/auth/line/callback` (prod)
4. Copy **Channel ID** and **Channel Secret**

---

## 7. LINE Messaging API

1. Create a **Messaging API** channel in LINE Developers Console
2. Issue a **Long-lived Channel Access Token**
3. Paste it as `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
4. (Optional) Each restaurant can have their own LINE OA. Set `line_channel_id`, `line_channel_secret`, and `line_channel_access_token` in the D1 `restaurants` table. If empty, the platform falls back to the global `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`.

---

## 8. Environment Variables

Create `.env.local`:

```env
# Session signing (generate a random 32+ char string)
SESSION_SECRET=your-random-32-char-secret-here

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# LINE Login
LINE_LOGIN_CHANNEL_ID=1234567890
LINE_LOGIN_CHANNEL_SECRET=abc123...
LINE_LOGIN_CALLBACK_URL=http://localhost:3000/api/auth/line/callback

# LINE Messaging (platform fallback)
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=xxx...

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=lunch@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Restaurant status update API key (for PATCH /api/orders/[id]/status)
RESTAURANT_API_KEY=your_secret_key_for_restaurant_dashboard
```

> **Cloudflare Pages:** Add all env vars in **Workers & Pages** → **Settings** → **Variables and Secrets**.

---

## 9. Run Locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## 10. Deploy to Cloudflare

```bash
npm run cf:build
wrangler pages deploy .open-next/assets
```

Or configure GitHub Actions for automatic deployment on push.

---

## Architecture

```
Landing page (/)
  ├── 3D Mapbox map of Xinyi District
  ├── Click marker → select office building
  ├── Pick date (weekdays only, tomorrow → +30 days)
  └── See available restaurants → click → /{slug}

Restaurant page (/{slug})
  ├── Browse bento menu (from D1 cached menu_items)
  ├── Add/remove items in cart
  ├── Apply coupon (validated server-side via D1)
  ├── LINE Login gate (redirect + return)
  └── Submit → POST /api/orders

POST /api/orders
  ├── Validates session (signed JWT cookie)
  ├── Writes order to D1 (source of truth)
  ├── Writes order to restaurant's Google Sheet (daily tab)
  ├── Validates & logs coupon usage
  └── Sends LINE Flex Message "pending" (non-blocking)

Staff updates status in Sheet
  │
  ▼
Google Apps Script → POST /api/webhooks/sheet-status
  ├── Updates D1 order status
  ├── Updates restaurant sheet status
  └── Sends LINE Flex Message to customer

My Orders (/my-orders)
  └── Lists user's orders from D1
```

---

## Test the Setup

After adding credentials and sharing sheets:

```bash
# Test D1 + restaurant sheet write
GET https://lunch.antu-technology.com/api/restaurants/siammore/test-sheets
```

Expected response:
```json
{
  "configured": true,
  "restaurantFound": true,
  "sheetsReady": true,
  "message": "成功寫入 饗泰多 松高店 的 Google Sheet！請查看 2026-06-04 分頁"
}
```

---

## Adding a New Restaurant

1. Create a new spreadsheet for the restaurant
2. Add tabs: `Instruction`, `Dashboard`, `Members`, `Promotions`, `Menu`
3. Fill the `Menu` tab with items
4. Share it with service account (Editor) and restaurant staff (Editor)
5. Insert a row into D1 `restaurants` table (use Wrangler or direct SQL)
6. Install **Google Apps Script** in the restaurant's sheet
7. Set `active = 1`

The new restaurant page is live at `lunch.antu-technology.com/{slug}` immediately — no code deploy needed.

---

## Restaurant D1 Schema Reference

When inserting a new restaurant into D1:

```sql
INSERT INTO restaurants (
  slug, name_zh, address, phone, banner_path, logo_path, tagline,
  cutoff_hour, min_order, delivery_fee, spreadsheet_id, api_key,
  active, location_ids, available_days,
  line_channel_id, line_channel_secret, line_channel_access_token
) VALUES (
  'siammore',
  '饗泰多 松高店',
  '台北市信義區松高路16號3樓',
  '02-27221728',
  '/siammore/banners/banner-siammore.jpg',
  '/siammore/logo/siammore logo.png',
  '雙主菜 + 三配菜 · 超有料餐盒',
  21,   -- cutoff hour
  0,    -- min order
  0,    -- delivery fee
  '1BxiMVs0XRA...',  -- restaurant's Google Sheet ID
  'sk-siammore-abc123',  -- webhook HMAC secret
  1,    -- active
  '["taipei-101","exchange-square","shin-kong-mitsukoshi","world-trade-center"]',
  '[1,2,3,4,5]',
  '',   -- line_channel_id (optional)
  '',   -- line_channel_secret (optional)
  ''    -- line_channel_access_token (optional)
);
```
