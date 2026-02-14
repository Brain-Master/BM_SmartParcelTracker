/**
 * Desktop Command Center — §4.1
 * Master Table, filters (потеряшки, теги, ожидают действий), Export CSV.
 */
import { MasterTable } from '../components/MasterTable'
import type { ParcelRow } from '../types'

const mockRows: ParcelRow[] = [
  {
    parcel: {
      id: '1',
      user_id: 'u1',
      tracking_number: 'RR123456789CN',
      carrier_slug: 'russian-post',
      status: 'In_Transit',
      tracking_updated_at: new Date().toISOString(),
      weight_kg: 0.5,
    },
    orderItems: [
      {
        id: 'oi1',
        order_id: 'o1',
        parcel_id: '1',
        item_name: 'Пример товара',
        image_url: null,
        tags: ['electronics', 'gift'],
        quantity_ordered: 2,
        quantity_received: 0,
        item_status: 'Shipped',
      },
    ],
    order: {
      id: 'o1',
      user_id: 'u1',
      platform: 'AliExpress',
      order_number_external: 'AE123',
      order_date: new Date().toISOString(),
      protection_end_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      price_original: 100,
      currency_original: 'USD',
      exchange_rate_frozen: 92.5,
      price_final_base: 9250,
      is_price_estimated: true,
      comment: null,
    },
  },
]

export function DesktopDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          📦 Smart Parcel Tracker
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Фильтры: Потеряшки · Ожидают действий · По тегам
        </p>
      </header>
      <MasterTable rows={mockRows} />
    </div>
  )
}
