import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const restaurants = sqliteTable('restaurants', {
  slug: text('slug').primaryKey(),
  nameZh: text('name_zh').notNull(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  bannerPath: text('banner_path').notNull().default(''),
  logoPath: text('logo_path').notNull().default(''),
  spreadsheetId: text('spreadsheet_id').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  tagline: text('tagline').notNull().default(''),
  cutoffHour: integer('cutoff_hour').notNull().default(21),
  locationIds: text('location_ids').notNull().default('[]'),
  availableDays: text('available_days').notNull().default('[]'),
  minOrder: real('min_order').notNull().default(0),
  deliveryFee: real('delivery_fee').notNull().default(0),
  apiKey: text('api_key').notNull().default(''),
  lineChannelId: text('line_channel_id').notNull().default(''),
  lineChannelSecret: text('line_channel_secret').notNull().default(''),
  lineChannelAccessToken: text('line_channel_access_token').notNull().default(''),
})

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  restaurantSlug: text('restaurant_slug').notNull().references(() => restaurants.slug),
  nameZh: text('name_zh').notNull(),
  description: text('description').notNull().default(''),
  price: real('price').notNull().default(0),
  category: text('category').notNull().default('bento'),
  imagePath: text('image_path').notNull().default(''),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(99),
  syncedAt: text('synced_at'),
})

export const users = sqliteTable('users', {
  lineUserId: text('line_user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  pictureUrl: text('picture_url').notNull().default(''),
  language: text('language').notNull().default('zh-TW'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const coupons = sqliteTable('coupons', {
  code: text('code').primaryKey(),
  discountType: text('discount_type').notNull().default('fixed'),
  discountValue: real('discount_value').notNull().default(0),
  minOrder: real('min_order').notNull().default(0),
  maxUses: integer('max_uses').notNull().default(999999),
  maxUsesPerUser: integer('max_uses_per_user').notNull().default(1),
  maxDiscount: real('max_discount'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  restaurantSlug: text('restaurant_slug').references(() => restaurants.slug),
})

export const couponRedemptions = sqliteTable('coupon_redemptions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  couponCode: text('coupon_code').notNull().references(() => coupons.code),
  lineUserId: text('line_user_id').notNull(),
  orderNumber: text('order_number').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})

export const orders = sqliteTable('orders', {
  orderNumber: text('order_number').primaryKey(),
  restaurantSlug: text('restaurant_slug').notNull().references(() => restaurants.slug),
  lineUserId: text('line_user_id').notNull(),
  buildingId: text('building_id').notNull(),
  deliveryDate: text('delivery_date').notNull(),
  status: text('status').notNull().default('pending'),
  subtotal: real('subtotal').notNull().default(0),
  discount: real('discount').notNull().default(0),
  deliveryFee: real('delivery_fee').notNull().default(0),
  total: real('total').notNull().default(0),
  couponCode: text('coupon_code').notNull().default(''),
  customerName: text('customer_name').notNull().default(''),
  company: text('company').notNull().default(''),
  phone: text('phone').notNull().default(''),
  specialNote: text('special_note').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().references(() => orders.orderNumber),
  menuItemId: text('menu_item_id').notNull(),
  nameZh: text('name_zh').notNull(),
  qty: integer('qty').notNull().default(1),
  unitPrice: real('unit_price').notNull().default(0),
  category: text('category').notNull().default(''),
})

export const sheetSyncEvents = sqliteTable('sheet_sync_events', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  direction: text('direction').notNull(), // 'to_sheet' | 'from_sheet'
  status: text('status').notNull().default('pending'), // 'pending' | 'success' | 'failed'
  error: text('error'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
})

export const notificationLogs = sqliteTable('notification_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  lineUserId: text('line_user_id').notNull(),
  orderNumber: text('order_number').notNull(),
  channel: text('channel').notNull().default('line_push'),
  status: text('status').notNull().default('pending'),
  error: text('error'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
})
