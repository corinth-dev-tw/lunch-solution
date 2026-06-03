# Master Google Sheet Setup

One spreadsheet controls all restaurants.  
`GOOGLE_SPREADSHEET_ID` (env var) = this master sheet's ID.  
Each restaurant has its OWN sheet for orders (and optionally a `Menu` tab).

---

## Quickstart — auto-setup via API

Once your env vars are set, call the setup endpoint **once** to create/update all tabs automatically:

```bash
curl -X POST https://lunch.antu-technology.com/api/admin/setup-sheets \
  -H "x-restaurant-key: YOUR_RESTAURANT_API_KEY"
```

Returns a log of everything created and any errors. **Safe to re-run** — idempotent.

---

## Tab 1: `Restaurants`

Headers in row 1, data from row 2:

| Col | Field | Example | Notes |
|-----|-------|---------|-------|
| A | `slug` | `siammore` | URL slug → `/siammore` |
| B | `name_zh` | `饗泰多 松高店` | Display name |
| C | `address` | `台北市信義區松高路16號3樓` | |
| D | `phone` | `02-27221728` | |
| E | `banner_path` | `/siammore/banners/banner-siammore.jpg` | Public asset path |
| F | `logo_path` | `/siammore/logo/siammore logo.png` | |
| G | `spreadsheet_id` | `1BxiMVs0XRA…` | Restaurant's OWN sheet ID |
| H | `active` | `TRUE` | `FALSE` to hide |
| I | `tagline` | `雙主菜 + 三配菜 · 超有料餐盒` | Shown on page |
| J | `cutoff_hour` | `21` | Order cutoff hour night before |
| K | `delivery_times` | `11:30,12:00,12:30` | Comma-separated time slots |

---

## Tab 2: `MenuItems`

Master menu fallback. Each restaurant can also manage a `Menu` tab in their own sheet (takes priority).

Headers in row 1, data from row 2:

| Col | Field | Example | Notes |
|-----|-------|---------|-------|
| A | `restaurant_slug` | `siammore` | Must match Restaurants.slug |
| B | `id` | `qtan` | Unique item ID |
| C | `name_zh` | `Q彈好咖餐盒` | |
| D | `description` | `脆口炸雞腿…` | |
| E | `price` | `200` | Integer NT$ |
| F | `category` | `bento` | `bento` / `drink` / `side` |
| G | `image_path` | `/siammore/products/qtan-bento.jpg` | |
| H | `available` | `TRUE` | `FALSE` to hide |
| I | `sort_order` | `1` | Lower = shown first |

---

## Tab 3: `Locations`

Controls which office buildings appear on the map and in pickers.

Headers in row 1, data from row 2:

| Col | Field | Example | Notes |
|-----|-------|---------|-------|
| A | `id` | `taipei-101` | URL-safe ID |
| B | `name_zh` | `台北101` | Chinese display name |
| C | `name` | `Taipei 101` | English name |
| D | `address` | `台北市信義區信義路五段7號` | |
| E | `lat` | `25.0339` | Decimal latitude |
| F | `lng` | `121.5645` | Decimal longitude |
| G | `active` | `TRUE` | `FALSE` to hide from map |

---

## Each Restaurant's Own Sheet

Create a separate Google Sheet per restaurant for orders (and optionally menus).

### Required: Share with service account

```
your-service-account@your-project.iam.gserviceaccount.com  →  Editor
```

Also share with restaurant staff as **Editor** so they can update order status.

### Auto-created: Daily order tabs

A new tab is created automatically for each delivery date the first time an order comes in.

| Col | Content |
|-----|---------|
| A | 訂單編號 |
| B | 時間（下單時刻） |
| C | 取餐日期 |
| D | 取餐地點 |
| E | 姓名 |
| F | 公司 |
| G | 電話 |
| H | LINE ID |
| I | 便當內容 |
| J | 便當數量 |
| K | 加購飲品 |
| L | 小計 |
| M | 優惠碼 |
| N | 折扣 |
| O | 應付金額 |
| P | 備註 |
| Q | 狀態 |
| R | 推播 |

**Status values** (staff edits column Q):
`⚪ 待確認` → `🟡 製作中` → `🟢 已出餐` → `💰 已收款`

### Optional: `Menu` tab (restaurant-managed menu)

If this tab exists, it **overrides** the master `MenuItems` tab for this restaurant.

| Col | Field | Example |
|-----|-------|---------|
| A | `id` | `qtan` |
| B | `name_zh` | `Q彈好咖餐盒` |
| C | `description` | `脆口炸雞腿…` |
| D | `price` | `200` |
| E | `category` | `bento` / `drink` / `side` |
| F | `image_path` | `/siammore/products/qtan-bento.jpg` |
| G | `available` | `TRUE` |
| H | `sort_order` | `1` |

---

## Adding a New Restaurant

1. Create a new Google Sheet → share with service account (Editor) + staff (Editor)
2. Copy its spreadsheet ID
3. Add a row to master sheet **Restaurants** tab
4. Paste the spreadsheet ID into column G
5. Add menu rows to **MenuItems** tab (or add a `Menu` tab to the restaurant's own sheet)
6. Set `active = TRUE`

The new restaurant page goes live at `lunch.antu-technology.com/[slug]` immediately — no deploy needed.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key (with `\n` escaped) |
| `GOOGLE_SPREADSHEET_ID` | Master sheet ID |
| `RESTAURANT_API_KEY` | Key for restaurant-facing API + admin endpoints |
| `COOKIE_SECRET` | 32-byte hex for session signing (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |

---

## Test the Setup

```bash
# 1. Run auto-setup
curl -X POST https://lunch.antu-technology.com/api/admin/setup-sheets \
  -H "x-restaurant-key: YOUR_KEY"

# 2. Test restaurant sheet write
curl https://lunch.antu-technology.com/api/restaurants/siammore/test-sheets

# 3. Verify config reads correctly
curl https://lunch.antu-technology.com/api/restaurants/siammore/config

# 4. Verify locations
curl https://lunch.antu-technology.com/api/locations
```
