# Master Google Sheet Setup

One spreadsheet controls all restaurants.  
`GOOGLE_SPREADSHEET_ID` (env var) = this master sheet's ID.  
Each restaurant has its OWN sheet for orders — staff only see theirs.

---

## Create the Master Sheet

1. Go to [Google Sheets](https://sheets.google.com) → create a blank spreadsheet
2. Name it: **午餐訂餐平台 - 主控表**
3. Copy the spreadsheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

---

## Tab 1: `Restaurants`

Create a tab named exactly **`Restaurants`** with these columns (row 1 = headers, row 2+ = data):

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| slug | name_zh | address | phone | banner_path | logo_path | spreadsheet_id | active | tagline | cutoff_hour |

**Paste this header row into A1:**
```
slug	name_zh	address	phone	banner_path	logo_path	spreadsheet_id	active	tagline	cutoff_hour
```

**Add 饗泰多 松高店 (row 2):**
```
siammore	饗泰多 松高店	台北市信義區松高路16號3樓	02-27221728	/siammore/banners/banner-siammore.jpg	/siammore/logo/siammore logo.png	(留空，等建立餐廳 Sheet 後填入)	TRUE	雙主菜 + 三配菜 · 超有料餐盒	21
```

**Column meanings:**
- `slug` — URL slug, e.g. `siammore` → `lunch.antu-technology.com/siammore`
- `spreadsheet_id` — the restaurant's OWN Google Sheet ID (see below)
- `active` — `TRUE` to show, `FALSE` to hide
- `cutoff_hour` — orders cut off at this hour the night before (21 = 9pm)

---

## Tab 2: `MenuItems`

Create a tab named exactly **`MenuItems`** with these columns:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| restaurant_slug | id | name_zh | description | price | category | image_path | available | sort_order |

**Paste this header row into A1:**
```
restaurant_slug	id	name_zh	description	price	category	image_path	available	sort_order
```

**Add 饗泰多 menu (rows 2–6):**
```
siammore	qtan	Q彈好咖餐盒	脆口炸雞腿 + 雙主菜 + 三配菜，Q彈鮮嫩超滿足	200	bento	/siammore/products/qtan-bento.jpg	TRUE	1
siammore	basil	開胃扒飯餐盒	香辣打拋豬 + 雙主菜 + 三配菜，開胃夠味泰式風	200	bento	/siammore/products/basil-bento.jpg	TRUE	2
siammore	kacha	咔滋爆爽餐盒	咔滋嫩牛 + 雙主菜 + 三配菜，爽脆口感每口過癮	200	bento	/siammore/products/kacha-bento.jpg	TRUE	3
siammore	milk-tea	泰式奶茶	濃郁奶香，泰式經典	60	drink	/siammore/products/thai-milk-tea.jpg	TRUE	4
siammore	lemon	泰式檸檬飲	清爽酸甜，消暑解膩	50	drink	/siammore/products/lemon-drink.jpg	TRUE	5
```

**`category` values:** `bento` | `drink` | `side`

---

## Create Each Restaurant's Order Sheet

For each restaurant (e.g. 饗泰多):

1. Create a **new separate spreadsheet** → name it: **饗泰多 松高店 - 訂單**
2. Copy its spreadsheet ID
3. Paste the ID into the master sheet's `Restaurants` tab → column G (`spreadsheet_id`)
4. **Share the restaurant's sheet** with the restaurant staff (Editor role)
5. **Also share it** with your service account email (Editor role):
   ```
   your-service-account@your-project.iam.gserviceaccount.com
   ```

> The platform (service account) creates daily tabs automatically.  
> Restaurant staff see only their own sheet — no cross-visibility.

---

## Share the Master Sheet with Service Account

The master sheet must also be shared with your service account (read access is enough):

- Share → add `your-service-account@your-project.iam.gserviceaccount.com` → **Viewer** role

---

## Adding a New Restaurant

1. Create a new spreadsheet for the restaurant
2. Share it with service account (Editor) and restaurant staff (Editor)
3. Add a row to **master sheet → `Restaurants`** tab
4. Add the menu rows to **master sheet → `MenuItems`** tab
5. Set `active = TRUE`

The new restaurant page is live at `lunch.antu-technology.com/[slug]` immediately — no code deploy needed.

---

## Test the Setup

After adding credentials to Cloudflare Pages env vars:

```
# Test master sheet reads + restaurant sheet write
GET https://lunch.antu-technology.com/api/restaurants/siammore/test-sheets
```

Returns:
```json
{
  "configured": true,
  "restaurantFound": true,
  "sheetsReady": true,
  "message": "✅ 成功寫入 饗泰多 松高店 的 Google Sheet！請查看 2026-06-04 分頁"
}
```

---

## Daily Order Sheet Format (auto-created)

Each day a new tab is created automatically when the first order comes in:

| 訂單編號 | 時間 | 取餐日期 | 取餐地點 | 姓名 | 公司 | 電話 | LINE ID | 便當內容 | 便當數量 | 加購飲品 | 小計 | 優惠碼 | 折扣 | 應付金額 | 備註 | 狀態 | 推播 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| STM-20260603-A1B2 | 2026/06/03 09:15 | 2026-06-03 | 台北101 | 王大明 | OO科技 | 0912-345-678 | | Q彈好咖餐盒×3 | 3 | 泰式奶茶×2 | 720 | | 0 | 720 | | ⚪ 待確認 | |

**Status values restaurant staff can change:**
- `⚪ 待確認` → `🟡 製作中` → `🟢 已出餐` → `💰 已收款`
