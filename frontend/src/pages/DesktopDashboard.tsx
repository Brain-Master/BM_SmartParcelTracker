/**
 * Desktop Command Center — Order-centric view.
 * Shows ALL orders (even without parcels), their items, and linked parcels.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { useParcels } from '../hooks/useParcels'
import { useOrders } from '../hooks/useOrders'
import { useCurrentUser } from '../hooks/useUsers'
import type { OrderRow, Order, OrderItem, Parcel } from '../types'

export function DesktopDashboard() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { parcels, loading: parcelsLoading, error: parcelsError, refetch: refetchParcels } = useParcels(true)
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders()
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})

  // Build order-centric rows
  const orderRows: OrderRow[] = useMemo(() => {
    // Collect all order items from parcels (they come with include_items=true)
    const allItems: OrderItem[] = []
    const parcelMap = new Map<string, Parcel>()

    for (const parcel of parcels) {
      parcelMap.set(parcel.id, parcel)
      const withItems = parcel as { order_items?: Array<Record<string, unknown>> }
      if (withItems.order_items) {
        for (const raw of withItems.order_items) {
          allItems.push({
            id: raw.id as string,
            order_id: raw.order_id as string,
            parcel_id: raw.parcel_id as string | null,
            item_name: raw.item_name as string,
            image_url: raw.image_url as string | null,
            tags: (raw.tags as string[]) || [],
            quantity_ordered: raw.quantity_ordered as number,
            quantity_received: raw.quantity_received as number,
            item_status: raw.item_status as OrderItem['item_status'],
          })
        }
      }
    }

    return orders.map((order: Order) => {
      const items = allItems.filter(i => i.order_id === order.id)
      const linkedParcelIds = new Set(items.map(i => i.parcel_id).filter(Boolean) as string[])
      const linkedParcels = Array.from(linkedParcelIds).map(pid => parcelMap.get(pid)).filter(Boolean) as Parcel[]

      return { order, items, parcels: linkedParcels }
    })
  }, [orders, parcels])

  // Also find "orphan" parcels (not linked to any order)
  const orphanParcels = useMemo(() => {
    const linkedParcelIds = new Set<string>()
    for (const row of orderRows) {
      for (const p of row.parcels) {
        linkedParcelIds.add(p.id)
      }
    }
    return parcels.filter(p => !linkedParcelIds.has(p.id))
  }, [orderRows, parcels])

  const loading = parcelsLoading || ordersLoading
  const error = parcelsError || ordersError

  const handleRetry = () => {
    refetchParcels()
    refetchOrders()
  }

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  const collapseAll = () => setExpandedOrders({})
  const expandAll = () => {
    const all: Record<string, boolean> = {}
    orderRows.forEach(r => { all[r.order.id] = true })
    setExpandedOrders(all)
  }

  const currencySymbol = user?.main_currency === 'USD' ? '$' : user?.main_currency === 'EUR' ? '€' : '₽'

  const formatPrice = (order: Order) => {
    const price = typeof order.price_final_base === 'string' ? parseFloat(order.price_final_base) : order.price_final_base
    return `${price.toFixed(0)} ${currencySymbol}`
  }

  const totalSum = orderRows.reduce((sum, row) => {
    const price = typeof row.order.price_final_base === 'string'
      ? parseFloat(row.order.price_final_base)
      : (row.order.price_final_base || 0)
    return sum + price
  }, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Главная</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          {orderRows.length} заказов, {parcels.length} посылок
        </p>
      </div>

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">📋</span>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Заказы</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{orderRows.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">📦</span>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Посылки</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{parcels.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🚚</span>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">В пути</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {parcels.filter(p => p.status === 'In_Transit').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">💰</span>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Сумма</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalSum.toFixed(0)} {currencySymbol}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner />}
      {!loading && error && <ErrorMessage message={error} onRetry={handleRetry} />}

      {!loading && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">Заказы и посылки</span>
            <div className="flex gap-2">
              <button onClick={expandAll} className="px-3 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                Развернуть все
              </button>
              <button onClick={collapseAll} className="px-3 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                Свернуть все
              </button>
            </div>
          </div>

          {/* Orders list */}
          {orderRows.length === 0 && orphanParcels.length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-lg mb-2">Пока нет заказов</p>
              <p className="text-sm">Создайте первый заказ, чтобы начать отслеживание</p>
              <button
                onClick={() => navigate('/orders/new')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Создать заказ
              </button>
            </div>
          )}

          {orderRows.map((row) => {
            const isExpanded = expandedOrders[row.order.id] || false
            return (
              <div key={row.order.id} className="border-b border-slate-100 dark:border-slate-700/50">
                {/* Order row */}
                <div
                  className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  onClick={() => toggleOrder(row.order.id)}
                >
                  <button className="w-6 text-slate-500 font-mono mr-2" aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}>
                    {isExpanded ? '−' : '+'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {row.order.platform}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        #{row.order.order_number_external}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(row.order.order_date).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        {formatPrice(row.order)}
                      </span>
                      <span className="text-slate-400">
                        {row.items.length} товар(ов)
                      </span>
                      <span className="text-slate-400">
                        {row.parcels.length} посылок
                      </span>
                      {row.order.protection_end_date && (() => {
                        const days = Math.ceil((new Date(row.order.protection_end_date).getTime() - Date.now()) / 86400000)
                        const color = days >= 10 ? 'text-green-600' : days >= 5 ? 'text-yellow-600' : 'text-red-600'
                        return <span className={`${color} font-medium`}>Защита: {days} дн.</span>
                      })()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/orders/${row.order.id}/edit`) }}
                    className="ml-2 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Ред.
                  </button>
                </div>

                {/* Expanded: items + parcels */}
                {isExpanded && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/30 px-4 pb-3">
                    {/* Items */}
                    {row.items.length > 0 ? (
                      <div className="ml-8 space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-1">Товары</p>
                        {row.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3 py-1 text-sm">
                            <span className="text-slate-700 dark:text-slate-300">{item.item_name}</span>
                            <span className="text-slate-400">
                              {item.quantity_received}/{item.quantity_ordered}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              item.item_status === 'Dispute_Open' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {item.item_status.replace('_', ' ')}
                            </span>
                            {item.parcel_id && (
                              <span className="text-xs text-slate-400">
                                📦 {parcels.find(p => p.id === item.parcel_id)?.tracking_number || '—'}
                              </span>
                            )}
                            {item.tags.length > 0 && item.tags.map(t => (
                              <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                                #{t}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="ml-8 text-sm text-slate-400 py-1">Нет товаров. Добавьте товары в заказ.</p>
                    )}

                    {/* Parcels linked to this order */}
                    {row.parcels.length > 0 && (
                      <div className="ml-8 mt-2 space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Посылки</p>
                        {row.parcels.map(parcel => (
                          <div key={parcel.id} className="flex items-center gap-3 py-1 text-sm">
                            <span className="text-slate-700 dark:text-slate-300">{parcel.tracking_number}</span>
                            <span className="text-slate-500">{parcel.carrier_slug}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {parcel.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Orphan parcels (not linked to any order) */}
          {orphanParcels.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  📦 Посылки без заказа ({orphanParcels.length})
                </p>
              </div>
              {orphanParcels.map(parcel => (
                <div key={parcel.id} className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="w-6 mr-2" />
                  <div className="flex-1 flex items-center gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{parcel.tracking_number}</span>
                    <span className="text-slate-500">{parcel.carrier_slug}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {parcel.status.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/parcels/${parcel.id}/edit`)}
                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Ред.
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
