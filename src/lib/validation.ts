import { z } from 'zod'

export const orderItemSchema = z.object({
  menu_item: z.object({
    id: z.string().min(1),
    restaurant_id: z.string().min(1),
    name: z.string().min(1),
    name_zh: z.string().min(1),
    description: z.string(),
    price: z.number().int().min(0),
    image_url: z.string(),
    available: z.boolean(),
    category: z.string().min(1),
  }),
  quantity: z.number().int().min(1),
  note: z.string().optional(),
})

export const orderItemInputSchema = z.object({
  id: z.string().min(1),
  name_zh: z.string().min(1),
  qty: z.number().int().min(1),
  price: z.number().int().min(0),
  category: z.string().min(1),
})

export const createOrderSchema = z.object({
  restaurantSlug: z.string().min(1),
  locationId: z.string().min(1),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(orderItemInputSchema).min(1),
  couponCode: z.string().optional(),
  discount: z.number().int().min(0).optional(),
  note: z.string().optional(),
  customerName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
})

export const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'preparing', 'ready', 'paid', 'cancelled']),
})

export const couponQuerySchema = z.object({
  code: z.string().min(1),
  subtotal: z.string().regex(/^\d+$/),
})

export const sheetWebhookSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  restaurantSlug: z.string().min(1),
  signature: z.string().min(1),
})
