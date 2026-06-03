-- Migration: append-only order status history + delivery time slot on orders
-- Run: npx wrangler d1 migrations apply lunch-db --remote

CREATE TABLE IF NOT EXISTS order_status_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  status    TEXT NOT NULL,
  source    TEXT NOT NULL CHECK (source IN ('api','webhook','system')),
  event_id  TEXT,                 -- dedup key from Apps Script webhook
  note      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ose_event_id
  ON order_status_events(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ose_order
  ON order_status_events(order_number, created_at);

-- Seed initial 'pending' event for every existing order
INSERT OR IGNORE INTO order_status_events (order_number, status, source)
SELECT order_number, status, 'system' FROM orders;

-- Add delivery_time column to orders (nullable — older rows have no slot)
ALTER TABLE orders ADD COLUMN delivery_time TEXT;
