/** API types aligned with System Design §2.1 */

export type MainCurrency = 'RUB' | 'USD' | 'EUR'

export type ParcelStatus =
  | 'Created'
  | 'In_Transit'
  | 'PickUp_Ready'
  | 'Delivered'
  | 'Lost'
  | 'Archived'

export type OrderItemStatus =
  | 'Waiting_Payment'
  | 'Payment_Verification'
  | 'Seller_Packing'
  | 'Partially_Shipped'
  | 'Shipped'
  | 'Partially_Received'
  | 'Received'
  | 'Cancelled'
  | 'Dispute_Open'
  | 'Refunded'
  | 'Waiting_Shipment'

/** Plan §6: RU labels for order item statuses */
export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  Waiting_Payment: 'Ждёт оплаты',
  Payment_Verification: 'Проверка платежа',
  Seller_Packing: 'Сборка продавцом',
  Partially_Shipped: 'Частично отправлено',
  Shipped: 'Отправлено',
  Partially_Received: 'Частично получено',
  Received: 'Получено',
  Cancelled: 'Отменено',
  Dispute_Open: 'Dispute открыт',
  Refunded: 'Возврат',
  Waiting_Shipment: 'Сборка продавцом',
}

export interface User {
  id: string
  email: string
  main_currency: MainCurrency
}

export interface Order {
  id: string
  user_id: string
  platform: string
  order_number_external: string
  label?: string | null
  order_date: string
  protection_end_date: string | null
  price_original: number
  currency_original: string
  exchange_rate_frozen: number
  price_final_base: number
  is_price_estimated: boolean
  comment: string | null
  shipping_cost?: number | null
  customs_cost?: number | null
  /** Set when order is soft-deleted (variant C: shared parcels). */
  deleted_at?: string | null
}

export interface Parcel {
  id: string
  user_id: string
  tracking_number: string
  carrier_slug: string
  label?: string | null
  status: ParcelStatus
  tracking_updated_at: string | null
  weight_kg: number | null
}

/** Quantity of an order item in one parcel (split shipments). */
export interface OrderItemInParcel {
  parcel_id: string
  quantity: number
}

export interface OrderItem {
  id: string
  order_id: string
  parcel_id: string | null
  item_name: string
  image_url: string | null
  tags: string[]
  quantity_ordered: number
  quantity_received: number
  item_status: OrderItemStatus
  price_per_item?: number | null
  /** Filled when orders loaded with include_items: split per parcel. */
  in_parcels?: OrderItemInParcel[]
  quantity_in_parcels?: number
  remaining_quantity?: number
  /** Set when parcel is loaded with items and this item's order is soft-deleted (заказ удалён). */
  order_deleted_at?: string | null
}

/** ParcelItem API: order item in a parcel with quantity. */
export interface ParcelItem {
  id: string
  parcel_id: string
  order_item_id: string
  quantity: number
}

/** Row for Master Table: Parcel + items (grouping) — legacy */
export interface ParcelRow {
  parcel: Parcel
  orderItems: OrderItem[]
  order?: Order
}

/** Row for new Order-centric Master Table */
export interface OrderRow {
  order: Order
  items: OrderItem[]
  parcels: Parcel[]
}
