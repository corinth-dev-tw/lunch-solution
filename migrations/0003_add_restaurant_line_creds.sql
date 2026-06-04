-- Migration: Add LINE OA credentials to restaurants table
-- Run: npx wrangler d1 execute lunch-db --local --file=./migrations/0003_add_restaurant_line_creds.sql

ALTER TABLE restaurants ADD COLUMN line_channel_id TEXT;
ALTER TABLE restaurants ADD COLUMN line_channel_secret TEXT;
ALTER TABLE restaurants ADD COLUMN line_channel_access_token TEXT;
