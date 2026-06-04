-- Seed data for local development
-- Run: npx wrangler d1 execute lunch-db --local --file=./migrations/0002_seed.sql

-- Buildings / office locations
INSERT OR IGNORE INTO buildings (id, name_zh, name, lat, lng, sort_order, active) VALUES
('taipei-101', '台北101辦公大樓', 'Taipei 101', 25.033, 121.565, 1, 1),
('exchange-square', '台北交易廣場', 'Taipei Exchange Square', 25.0335, 121.5645, 2, 1),
('shin-kong-mitsukoshi', '新光三越信義新天地', 'Shin Kong Mitsukoshi', 25.034, 121.566, 3, 1),
('world-trade-center', '世界貿易中心', 'World Trade Center', 25.0325, 121.5635, 4, 1);

-- Restaurant
INSERT OR IGNORE INTO restaurants (slug, name_zh, address, phone, banner_path, logo_path, tagline, cutoff_hour, min_order, delivery_fee, spreadsheet_id, api_key, active, location_ids, available_days, line_channel_id, line_channel_secret, line_channel_access_token) VALUES
('siammore', '饗泰多 松高店', '台北市信義區松高路16號3樓', '02-27221728', '/siammore/banners/banner-siammore.jpg', '/siammore/logo/siammore logo.png', '雙主菜 + 三配菜 · 超有料餐盒', 21, 0, 0, '', 'dev-key-siammore', 1, '["taipei-101","exchange-square","shin-kong-mitsukoshi","world-trade-center"]', '[1,2,3,4,5]', '', '', '');

-- Menu items
INSERT OR IGNORE INTO menu_items (id, restaurant_slug, name_zh, description, price, category, image_path, sort_order, available) VALUES
('qtan', 'siammore', 'Q彈好咖餐盒', 'Q彈脆口「酥炸松阪豬」+濃香滑順「黃金咖喱雞」', 200, 'bento', '/siammore/products/qtan-bento.jpg', 1, 1),
('basil', 'siammore', '開胃扒飯餐盒', '經典白飯殺手「扒飯打拋豬」+酸甜開胃「泰式手撕雞涼拌」', 200, 'bento', '/siammore/products/basil-bento.jpg', 2, 1),
('kacha', 'siammore', '咔滋爆爽餐盒', '酥脆多汁「咔滋椒麻雞」+鹹香下飯「蠔氣爆炒牛」', 200, 'bento', '/siammore/products/kacha-bento.jpg', 3, 1),
('milk-tea', 'siammore', '泰式奶茶', '濃郁奶香，泰式經典', 30, 'drink', '/siammore/products/thai-milk-tea.jpg', 4, 1),
('lemon', 'siammore', '檸檬茶', '清爽酸甜，消暑解膩', 20, 'drink', '/siammore/products/lemon-drink.jpg', 5, 1);

-- Coupons
INSERT OR IGNORE INTO coupons (code, discount_type, discount_value, min_order, max_uses, max_uses_per_user, start_date, end_date, active) VALUES
('LUNCH50', 'fixed', 50, 200, 100, 1, '2026-01-01', '2026-12-31', 1),
('NEWUSER', 'fixed', 100, 300, 50, 1, '2026-01-01', '2026-12-31', 1),
('HAPPY10', 'percent', 10, 150, 200, 1, '2026-01-01', '2026-12-31', 1);
