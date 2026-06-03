# 信義午餐 (Lunch Solution)

A lunch pre-ordering platform for Xinyi District office workers. Built with Next.js 15, deployed on Cloudflare Workers, with Cloudflare D1 as the source of truth and Google Sheets as the restaurant operations interface.

## Features

- 🗺️ **3D Mapbox map** of Xinyi District with interactive building markers
- 📅 **Date & location picker** — select your office building and pickup date
- 🍱 **Restaurant menu browsing** — browse bento boxes, drinks, and sides
- 🔐 **LINE Login** — one-tap authentication with LINE
- 🎫 **Coupon codes** — validated server-side against D1
- 📝 **Order tracking** — view your order history
- 📲 **LINE Flex Messages** — real-time order status notifications
- 📊 **Restaurant operations** — each restaurant manages orders in their own Google Sheet

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Auth | LINE Login OAuth 2.0 + signed JWT cookies (`jose`) |
| Database | Cloudflare D1 (SQLite) |
| Sheets | Google Sheets API (restaurant daily tabs, menu input) |
| Messaging | LINE Messaging API (Flex Messages) |
| Map | Mapbox GL JS |
| Deploy | Cloudflare Workers (OpenNext) |

## Architecture

```
User Journey:
Landing (/) → 3D Map → pick location/date → click restaurant
   │
   ▼
/{slug} → browse menu → LINE login → checkout
   │
   ▼
POST /api/orders
   ├── Writes order to D1 (source of truth)
   ├── Writes order to restaurant's Google Sheet (daily tab)
   ├── Validates & logs coupon usage
   └── Sends LINE Flex Message "pending"

Staff updates status in Sheet
   │
   ▼
Google Apps Script → POST /api/webhooks/sheet-status
   ├── Updates D1 order status
   ├── Updates restaurant sheet status
   └── Sends LINE Flex Message to customer
```

## Quick Start

```bash
npm install
npm run dev
```

See [SETUP.md](./SETUP.md) for full configuration (D1, Google Sheets, LINE, Mapbox, Cloudflare).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Next.js production build |
| `npm run cf:build` | Cloudflare Workers build (OpenNext) |
| `npm run deploy` | Deploy to Cloudflare |

## License

Private — All rights reserved.
