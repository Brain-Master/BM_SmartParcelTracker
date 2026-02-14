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
  | 'Waiting_Shipment'
  | 'Shipped'
  | 'Received'
  | 'Dispute_Open'
  | 'Refunded'

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
  order_date: string
  protection_end_date: string | null
  price_original: number
  currency_original: string
  exchange_rate_frozen: number
  price_final_base: number
  is_price_estimated: boolean
  comment: string | null
}

export interface Parcel {
  id: string
  user_id: string
  tracking_number: string
  carrier_slug: string
  status: ParcelStatus
  tracking_updated_at: string | null
  weight_kg: number | null
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
}

/** Row for Master Table: Parcel + items (grouping) */
export interface ParcelRow {
  parcel: Parcel
  orderItems: OrderItem[]
  order?: Order
}
