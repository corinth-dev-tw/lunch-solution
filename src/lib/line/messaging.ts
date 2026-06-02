import { Order, OrderStatus } from '@/types'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '⏳ 待確認',
  confirmed: '✅ 已確認',
  preparing: '👨‍🍳 備餐中',
  ready: '🎉 可取餐',
  delivered: '✔️ 已送達',
  cancelled: '❌ 已取消',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#aaaaaa',
  confirmed: '#00B900',
  preparing: '#FF8C00',
  ready: '#00B900',
  delivered: '#555555',
  cancelled: '#cc0000',
}

function buildOrderFlexMessage(order: Order, status: OrderStatus) {
  const statusLabel = STATUS_LABELS[status]
  const statusColor = STATUS_COLORS[status]
  const itemsText = order.items
    .map((i) => `${i.menu_item_name} x${i.quantity}`)
    .join('\n')

  return {
    type: 'flex',
    altText: `訂單 ${order.order_number} 狀態更新：${statusLabel}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🍱 午餐訂單通知',
            weight: 'bold',
            color: '#ffffff',
            size: 'lg',
          },
        ],
        backgroundColor: '#1DB954',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '訂單編號', color: '#888888', size: 'sm', flex: 2 },
              { type: 'text', text: order.order_number, weight: 'bold', size: 'sm', flex: 3 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '訂單狀態', color: '#888888', size: 'sm', flex: 2 },
              {
                type: 'text',
                text: statusLabel,
                weight: 'bold',
                color: statusColor,
                size: 'sm',
                flex: 3,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '取餐日期', color: '#888888', size: 'sm', flex: 2 },
              { type: 'text', text: order.delivery_date, size: 'sm', flex: 3 },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '訂購內容', color: '#888888', size: 'sm' },
              {
                type: 'text',
                text: itemsText,
                size: 'sm',
                wrap: true,
                margin: 'sm',
              },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '合計', weight: 'bold', flex: 2 },
              {
                type: 'text',
                text: `NT$ ${order.total}`,
                weight: 'bold',
                color: '#1DB954',
                align: 'end',
                flex: 3,
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '查看我的訂單',
              uri: `${process.env.NEXT_PUBLIC_APP_URL}/my-orders`,
            },
            style: 'primary',
            color: '#1DB954',
          },
        ],
      },
    },
  }
}

export async function pushOrderStatus(
  lineUserId: string,
  order: Order,
  status: OrderStatus
): Promise<void> {
  const message = buildOrderFlexMessage(order, status)
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [message],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LINE push failed: ${err}`)
  }
}
