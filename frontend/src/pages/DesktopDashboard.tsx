/**
 * Desktop Command Center — §4.1
 * Master Table, filters (потеряшки, теги, ожидают действий), Export CSV.
 */
import { useMemo } from 'react'
import { MasterTable } from '../components/MasterTable'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { useParcels } from '../hooks/useParcels'
import { useOrders } from '../hooks/useOrders'
import type { ParcelRow, OrderItem } from '../types'

export function DesktopDashboard() {
  const { parcels, loading: parcelsLoading, error: parcelsError, refetch: refetchParcels } = useParcels()
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders()

  const rows: ParcelRow[] = useMemo(() => {
    // Group parcels with their order items and orders
    // This is a simplified version - in production, you'd want to fetch 
    // related data through proper API endpoints
    return parcels.map(parcel => ({
      parcel,
      orderItems: [] as OrderItem[], // Will be populated when order_items endpoint is ready
      order: orders.find(o => o.user_id === parcel.user_id),
    }))
  }, [parcels, orders])

  const loading = parcelsLoading || ordersLoading
  const error = parcelsError || ordersError

  const handleRetry = () => {
    refetchParcels()
    refetchOrders()
  }

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

      {loading && <LoadingSpinner />}
      {!loading && error && <ErrorMessage message={error} onRetry={handleRetry} />}
      {!loading && !error && <MasterTable rows={rows} />}
    </div>
  )
}
