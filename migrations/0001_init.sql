-- D1 Schema for lunch-solution
-- Cloudflare D1 (SQLite) primary database

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name TEXT,
  lat REAL,
  lng REAL,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  slug TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  banner_path TEXT,
  logo_path TEXT,
  tagline TEXT,
  cutoff_hour INTEGER DEFAULT 21,
  min_order INTEGER DEFAULT 0,
  delivery_fee INTEGER DEFAULT 0,
  spreadsheet_id TEXT,
  api_key TEXT,
  active INTEGER DEFAULT 1,
  location_ids TEXT,
  available_days TEXT,
  line_channel_id TEXT,
  line_channel_secret TEXT,
  line_channel_access_token TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
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
  PRIMARY KEY (restaurant_slug, id)
);

CREATE TABLE IF NOT EXISTS users (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  language TEXT DEFAULT 'zh-TW',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value INTEGER NOT NULL,
  min_order INTEGER DEFAULT 0,
  max_discount INTEGER,
  max_uses INTEGER DEFAULT 999999,
  max_uses_per_user INTEGER DEFAULT 1,
  start_date TEXT,
  end_date TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_code TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (coupon_code, line_user_id, order_number)
);

CREATE TABLE IF NOT EXISTS orders (
  order_number TEXT PRIMARY KEY,
  restaurant_slug TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  building_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','ready','paid','cancelled')),
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sheet_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('restaurant_daily')),
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
  attempts INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'line_platform',
  message_id TEXT,
  error TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_slug, available);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(line_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_date ON orders(restaurant_slug, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_order ON sheet_sync_events(order_number, target);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notification_logs(order_number);
