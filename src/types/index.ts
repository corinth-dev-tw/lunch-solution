export interface Location {
  id: string
  name: string
  name_zh: string
  address: string
  coordinates: [number, number] // [lng, lat]
}

export interface Restaurant {
  id: string
  name: string
  name_zh: string
  description: string
  image_url: string
  location_ids: string[]
  available_days: number[] // 0=Sun, 1=Mon, ..., 5=Fri
  cutoff_hour: number // orders cut off at this hour the day before
  min_order: number
  delivery_fee: number
}

export interface MenuItem {
  id: string
  restaurant_id: string
  name: string
  name_zh: string
  description: string
  price: number
  image_url: string
  available: boolean
  category: string
}

export interface CartItem {
  menu_item: MenuItem
  quantity: number
  note?: string
}

export interface Member {
  id: string
  line_user_id: string
  display_name: string
  picture_url?: string
  email?: string
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_order: number
  max_uses: number
  used_count: number
  expires_at: string
  restaurant_id?: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  note?: string
}

export interface Order {
  id: string
  order_number: string
  member_id: string
  restaurant_id: string
  location_id: string
  delivery_date: string // YYYY-MM-DD
  status: OrderStatus
  subtotal: number
  discount: number
  delivery_fee: number
  total: number
  coupon_code?: string
  coupon_id?: string
  special_note?: string
  items: OrderItem[]
  created_at: string
  updated_at: string
}

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  email?: string
}
