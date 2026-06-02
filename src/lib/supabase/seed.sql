-- Seed restaurants
INSERT INTO restaurants (id, name, name_zh, description, image_url, location_ids, available_days, cutoff_hour, min_order, delivery_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Din Tai Fung', '鼎泰豐', '聞名全球的小籠包與江浙料理，信義新光三越限定便當。', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=400&fit=crop', ARRAY['taipei-101','exchange-square','shin-kong-mitsukoshi','world-trade-center'], ARRAY[1,2,3,4,5], 21, 180, 0),
  ('22222222-2222-2222-2222-222222222222', 'Addiction Aquatic', '上引水產', '新鮮海鮮便當，每日市場直送，限量供應。', 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=600&h=400&fit=crop', ARRAY['taipei-101','att-4-fun','breeze-xinyi'], ARRAY[1,2,3,4,5], 20, 250, 30),
  ('33333333-3333-3333-3333-333333333333', 'Shin Yeh', '欣葉台菜', '道地台灣古早味，精選台式家常便當。', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&h=400&fit=crop', ARRAY['taipei-101','taipei-city-hall','world-trade-center','exchange-square'], ARRAY[1,2,3,4,5], 21, 150, 0),
  ('44444444-4444-4444-4444-444444444444', 'Yakiniku Like', '燒肉Like', '個人燒肉套餐，信義店限定午間便當，附湯品沙拉。', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=400&fit=crop', ARRAY['att-4-fun','shin-kong-mitsukoshi','breeze-xinyi'], ARRAY[1,2,3,4,5], 20, 200, 0),
  ('55555555-5555-5555-5555-555555555555', 'Mos Burger', '摩斯漢堡', '日式漢堡套餐，嚴選台灣食材，健康美味兼顧。', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop', ARRAY['taipei-101','taipei-city-hall','exchange-square','world-trade-center','att-4-fun'], ARRAY[1,2,3,4,5], 22, 100, 0);

-- Seed menu items for 鼎泰豐
INSERT INTO menu_items (restaurant_id, name, name_zh, description, price, image_url, category, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Xiaolongbao Set', '小籠包便當', '6顆小籠包+炒青菜+白飯', 220, 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop', 'bento', 1),
  ('11111111-1111-1111-1111-111111111111', 'Pork Chop Rice', '排骨飯', '手工炸排骨+滷蛋+白飯+湯', 190, 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop', 'bento', 2),
  ('11111111-1111-1111-1111-111111111111', 'Braised Beef Noodle', '紅燒牛肉麵便當', '招牌紅燒牛肉+麵條+小菜', 250, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop', 'bento', 3),
  ('11111111-1111-1111-1111-111111111111', 'Vegetarian Set', '蔬食便當', '豆腐+炒蔬菜+白飯，適合素食者', 180, NULL, 'bento', 4);

-- Seed menu items for 欣葉台菜
INSERT INTO menu_items (restaurant_id, name, name_zh, description, price, image_url, category, sort_order) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Three Cup Chicken', '三杯雞便當', '傳統三杯雞+兩道小菜+白飯', 160, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop', 'bento', 1),
  ('33333333-3333-3333-3333-333333333333', 'Braised Pork Rice', '爌肉飯', '慢燉滷肉+滷蛋+筍乾+白飯', 150, 'https://images.unsplash.com/photo-1594179047519-f347310d3322?w=400&h=300&fit=crop', 'bento', 2),
  ('33333333-3333-3333-3333-333333333333', 'Oyster Vermicelli', '蚵仔麵線便當', '鮮蚵大腸麵線+烤麵包', 140, NULL, 'bento', 3);

-- Seed coupons
INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, expires_at) VALUES
  ('LUNCH50', 'fixed', 50, 200, 100, now() + interval '30 days'),
  ('NEWUSER', 'fixed', 100, 300, 50, now() + interval '60 days'),
  ('HAPPY10', 'percent', 10, 150, 200, now() + interval '14 days');
