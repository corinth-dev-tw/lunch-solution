-- Initial schema for lunch-solution D1

CREATE TABLE IF NOT EXISTS restaurants (
  slug TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  banner_path TEXT NOT NULL DEFAULT '',
  logo_path TEXT NOT NULL DEFAULT '',
  spreadsheet_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  tagline TEXT NOT NULL DEFAULT '',
  cutoff_hour INTEGER NOT NULL DEFAULT 21,
  location_ids TEXT NOT NULL DEFAULT '[]',
  available_days TEXT NOT NULL DEFAULT '[]',
  min_order REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  api_key TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_slug TEXT NOT NULL REFERENCES restaurants(slug),
  name_zh TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'bento',
  image_path TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 99,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_slug, available);

CREATE TABLE IF NOT EXISTS users (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  picture_url TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'zh-TW',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  discount_value REAL NOT NULL DEFAULT 0,
  min_order REAL NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 999999,
  max_uses_per_user INTEGER NOT NULL DEFAULT 1,
  max_discount REAL,
  start_date TEXT,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  restaurant_slug TEXT REFERENCES restaurants(slug)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_code TEXT NOT NULL REFERENCES coupons(code),
  line_user_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(coupon_code, line_user_id);

CREATE TABLE IF NOT EXISTS orders (
  order_number TEXT PRIMARY KEY,
  restaurant_slug TEXT NOT NULL REFERENCES restaurants(slug),
  line_user_id TEXT NOT NULL,
  building_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  coupon_code TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  special_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(line_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_date ON orders(restaurant_slug, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  menu_item_id TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_number);

CREATE TABLE IF NOT EXISTS sheet_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sheet_sync_events(status, direction);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'line_push',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_order ON notification_logs(order_number);
