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

const PROTECTION_DAYS_THRESHOLD = 7
type PresetKey = 'none' | 'lost' | 'protection' | 'pickup' | 'no_items' | 'orphans_only' | 'completed' | 'received'
type SortByKey = 'date' | 'protection' | 'platform' | 'amount' | 'status' | 'order_number' | 'label'

const PARCEL_STATUS_PRIORITY: Record<string, number> = {
  Lost: 6, In_Transit: 5, PickUp_Ready: 4, Delivered: 3, Archived: 2, Created: 1,
}

function orderRowWorstStatus(row: OrderRow): number {
  if (row.parcels.length === 0) return 0
  return Math.max(...row.parcels.map(p => PARCEL_STATUS_PRIORITY[p.status] ?? 0))
}

function orderRowMatchesSearch(row: OrderRow, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.trim().toLowerCase()
  if (row.order.platform.toLowerCase().includes(lower)) return true
  if (row.order.order_number_external.toLowerCase().includes(lower)) return true
  const orderLabel = (row.order as { label?: string | null }).label
  if (orderLabel?.toLowerCase().includes(lower)) return true
  for (const p of row.parcels) {
    if (p.tracking_number.toLowerCase().includes(lower)) return true
  }
  for (const i of row.items) {
    if (i.item_name.toLowerCase().includes(lower)) return true
  }
  return false
}

function parcelMatchesSearch(p: Parcel, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.trim().toLowerCase()
  if (p.tracking_number.toLowerCase().includes(lower)) return true
  if (p.carrier_slug.toLowerCase().includes(lower)) return true
  if (p.label?.toLowerCase().includes(lower)) return true
  return false
}

function orderRowMatchesPreset(row: OrderRow, preset: PresetKey): boolean {
  if (preset === 'none') return true
  if (preset === 'orphans_only') return false
  if (preset === 'no_items') return row.items.length === 0
  if (preset === 'lost') return row.parcels.some(p => p.status === 'Lost')
  if (preset === 'protection') {
    if (!row.order.protection_end_date) return false
    const end = new Date(row.order.protection_end_date).getTime()
    const days = Math.ceil((end - Date.now()) / 86400000)
    return days >= 0 && days <= PROTECTION_DAYS_THRESHOLD
  }
  if (preset === 'pickup') return row.parcels.some(p => p.status === 'PickUp_Ready')
  if (preset === 'completed' || preset === 'received') {
    if (row.parcels.length === 0) return false
    return row.parcels.every(p => p.status === 'Delivered' || p.status === 'Archived')
  }
  return true
}

function parcelMatchesPreset(p: Parcel, preset: PresetKey): boolean {
  if (preset === 'none') return true
  if (preset === 'orphans_only') return true
  if (preset === 'no_items') return false
  if (preset === 'lost') return p.status === 'Lost'
  if (preset === 'pickup') return p.status === 'PickUp_Ready'
  if (preset === 'protection') return false
  if (preset === 'completed' || preset === 'received') return p.status === 'Delivered' || p.status === 'Archived'
  return true
}

export function DesktopDashboard() {
  const navigate = useNavigate()
  useCurrentUser()
  const [showArchived, setShowArchived] = useState(false)
  const { parcels, loading: parcelsLoading, error: parcelsError, refetch: refetchParcels, deleteParcel, archiveParcel } = useParcels(false, showArchived)
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders, deleteOrder, archiveOrder } = useOrders(true, showArchived)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)
  const [archivingOrderId, setArchivingOrderId] = useState<string | null>(null)
  const [archivingParcelId, setArchivingParcelId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  const [activePreset, setActivePreset] = useState<PresetKey>('none')
  const [sortBy, setSortBy] = useState<SortByKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Build order-centric rows — items come from orders (include_items=true)
  const orderRows: OrderRow[] = useMemo(() => {
    const parcelMap = new Map<string, Parcel>()
    for (const parcel of parcels) {
      parcelMap.set(parcel.id, parcel)
    }

    return orders.map((order) => {
      const orderWithItems = order as unknown as { order_items?: Array<Record<string, unknown>> }
      const items: OrderItem[] = (orderWithItems.order_items || []).map((raw) => ({
        id: raw.id as string,
        order_id: raw.order_id as string,
        parcel_id: raw.parcel_id as string | null,
        item_name: raw.item_name as string,
        image_url: raw.image_url as string | null,
        tags: (raw.tags as string[]) || [],
        quantity_ordered: raw.quantity_ordered as number,
        quantity_received: raw.quantity_received as number,
        item_status: raw.item_status as OrderItem['item_status'],
        price_per_item: raw.price_per_item as number | null | undefined,
        in_parcels: raw.in_parcels as OrderItem['in_parcels'],
        quantity_in_parcels: raw.quantity_in_parcels as number | undefined,
        remaining_quantity: raw.remaining_quantity as number | undefined,
      }))
      // Parcels linked via items' in_parcels (split) or parcel_id (legacy)
      const linkedParcelIds = new Set<string>()
      for (const i of items) {
        if (i.parcel_id) linkedParcelIds.add(i.parcel_id)
        for (const ip of i.in_parcels ?? []) {
          linkedParcelIds.add(ip.parcel_id)
        }
      }
      const linkedParcels = Array.from(linkedParcelIds).map(pid => parcelMap.get(pid)).filter(Boolean) as Parcel[]

      return { order, items, parcels: linkedParcels }
    })
  }, [orders, parcels])

  // Also find "orphan" parcels (not linked to any order via items)
  const orphanParcels = useMemo(() => {
    const linkedParcelIds = new Set<string>()
    for (const row of orderRows) {
      for (const p of row.parcels) {
        linkedParcelIds.add(p.id)
      }
    }
    return parcels.filter(p => !linkedParcelIds.has(p.id))
  }, [orderRows, parcels])

  // Filter and sort order rows
  const sortedOrderRows = useMemo(() => {
    let rows = orderRows.filter(row => orderRowMatchesSearch(row, searchQuery))
    if (filterPlatform) {
      rows = rows.filter(row => row.order.platform === filterPlatform)
    }
    if (filterCarrier) {
      rows = rows.filter(row => row.parcels.some(p => p.carrier_slug === filterCarrier))
    }
    rows = rows.filter(row => orderRowMatchesPreset(row, activePreset))
    const mult = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortBy === 'date') {
        const da = new Date(a.order.order_date).getTime()
        const db = new Date(b.order.order_date).getTime()
        return mult * (da - db)
      }
      if (sortBy === 'protection') {
        const pa = a.order.protection_end_date ? new Date(a.order.protection_end_date).getTime() : 0
        const pb = b.order.protection_end_date ? new Date(b.order.protection_end_date).getTime() : 0
        return mult * (pa - pb)
      }
      if (sortBy === 'platform') {
        const cmp = a.order.platform.localeCompare(b.order.platform)
        return mult * cmp
      }
      if (sortBy === 'amount') {
        const va = a.order.price_final_base ?? 0
        const vb = b.order.price_final_base ?? 0
        return mult * (va - vb)
      }
      if (sortBy === 'status') {
        const sa = orderRowWorstStatus(a)
        const sb = orderRowWorstStatus(b)
        return mult * (sa - sb)
      }
      if (sortBy === 'order_number') {
        const cmp = a.order.order_number_external.localeCompare(b.order.order_number_external)
        return mult * cmp
      }
      if (sortBy === 'label') {
        const la = (a.order as { label?: string | null }).label ?? ''
        const lb = (b.order as { label?: string | null }).label ?? ''
        return mult * la.localeCompare(lb)
      }
      return 0
    })
  }, [orderRows, searchQuery, filterPlatform, filterCarrier, activePreset, sortBy, sortDir])

  const filteredOrphanParcels = useMemo(() => {
    let list = orphanParcels.filter(p => parcelMatchesSearch(p, searchQuery))
    if (filterCarrier) {
      list = list.filter(p => p.carrier_slug === filterCarrier)
    }
    list = list.filter(p => parcelMatchesPreset(p, activePreset))
    if (filterPlatform) {
      return []
    }
    return [...list].sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'date') return 0
      if (sortBy === 'platform') {
        return mult * a.carrier_slug.localeCompare(b.carrier_slug)
      }
      if (sortBy === 'protection') return 0
      if (sortBy === 'amount') return 0
      if (sortBy === 'status') {
        return mult * ((PARCEL_STATUS_PRIORITY[a.status] ?? 0) - (PARCEL_STATUS_PRIORITY[b.status] ?? 0))
      }
      if (sortBy === 'order_number') {
        return mult * a.tracking_number.localeCompare(b.tracking_number)
      }
      if (sortBy === 'label') {
        return mult * (a.label ?? '').localeCompare(b.label ?? '')
      }
      return mult * a.tracking_number.localeCompare(b.tracking_number)
    })
  }, [orphanParcels, searchQuery, filterCarrier, filterPlatform, activePreset, sortBy, sortDir])

  const loading = parcelsLoading || ordersLoading
  const error = parcelsError || ordersError

  const handleRetry = () => {
    refetchParcels()
    refetchOrders()
  }

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  const handleDeleteParcel = async (parcelId: string) => {
    if (!window.confirm('Удалить посылку? Привязки товаров к ней будут сняты.')) return
    const ok = await deleteParcel(parcelId)
    if (ok) {
      refetchParcels()
      refetchOrders()
    }
  }

  const handleDeleteOrder = async (orderId: string, platform: string, orderNumber: string) => {
    if (!window.confirm(`Удалить заказ ${platform} #${orderNumber}? Если есть только эксклюзивные посылки — они будут удалены; при общих посылках заказ будет помечен как удалённый.`)) return
    setDeletingOrderId(orderId)
    const ok = await deleteOrder(orderId)
    setDeletingOrderId(null)
    if (ok) {
      refetchOrders()
      refetchParcels()
    }
  }

  const handleArchiveOrder = async (orderId: string) => {
    setArchivingOrderId(orderId)
    const ok = await archiveOrder(orderId)
    setArchivingOrderId(null)
    if (ok) {
      refetchOrders()
      refetchParcels()
    }
  }

  const handleArchiveParcel = async (parcelId: string) => {
    setArchivingParcelId(parcelId)
    const ok = await archiveParcel(parcelId)
    setArchivingParcelId(null)
    if (ok) {
      refetchOrders()
      refetchParcels()
    }
  }

  const collapseAll = () => setExpandedOrders({})
  const expandAll = () => {
    const all: Record<string, boolean> = {}
    sortedOrderRows.forEach(r => { all[r.order.id] = true })
    setExpandedOrders(all)
  }

  const resetAllFilters = () => {
    setSearchQuery('')
    setFilterPlatform('')
    setFilterCarrier('')
    setActivePreset('none')
    setSortBy('date')
    setSortDir('desc')
  }

  const hasActiveFilters = searchQuery.trim() !== '' || filterPlatform !== '' || filterCarrier !== '' || activePreset !== 'none'
  const orderIsArchived = (order: Order) => !!(order as { is_archived?: boolean }).is_archived
  const parcelIsArchived = (parcel: Parcel) => !!(parcel as { is_archived?: boolean }).is_archived

  // Derive filter options from actual data (not empty stores/carriers API)
  const filterPlatformOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of orderRows) set.add(row.order.platform)
    return Array.from(set).sort()
  }, [orderRows])
  const filterCarrierOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of parcels) set.add(p.carrier_slug)
    return Array.from(set).sort()
  }, [parcels])

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$'
      case 'EUR': return '€'
      case 'RUB': return '₽'
      default: return currency
    }
  }

  const formatPrice = (order: Order) => {
    // Show original price in original currency (not converted)
    const price = typeof order.price_original === 'string' ? parseFloat(order.price_original) : order.price_original
    const symbol = getCurrencySymbol(order.currency_original)
    return `${price.toFixed(0)} ${symbol}`
  }

  // Calculate total sums grouped by currency (since we can't reliably convert without knowing base currency at creation time)
  const totalsByCurrency = orderRows.reduce((totals, row) => {
    const order = row.order
    const currency = order.currency_original
    const price = typeof order.price_original === 'string'
      ? parseFloat(order.price_original)
      : (order.price_original || 0)
    
    if (!totals[currency]) {
      totals[currency] = 0
    }
    totals[currency] += price
    return totals
  }, {} as Record<string, number>)

  // Format totals as string (e.g. "10000 ₽ + 500 $ + 300 €")
  const totalSummary = Object.entries(totalsByCurrency)
    .map(([currency, total]) => `${total.toFixed(0)} ${getCurrencySymbol(currency)}`)
    .join(' + ') || '0'

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
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {totalSummary}
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
          {/* Search, presets, filters, sort */}
          <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск: номер заказа, магазин, название, трек, товар..."
                className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Поиск по заказам и посылкам"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'lost' ? 'none' : 'lost')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'lost' ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Потеряшки
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'protection' ? 'none' : 'protection')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'protection' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Заканчивается защита
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'pickup' ? 'none' : 'pickup')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'pickup' ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Готовы к получению
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'no_items' ? 'none' : 'no_items')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'no_items' ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Заказы без товаров
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'orphans_only' ? 'none' : 'orphans_only')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'orphans_only' ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Посылки без заказов
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'completed' ? 'none' : 'completed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'completed' ? 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Завершённые
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 'received' ? 'none' : 'received')}
                  className={`px-3 py-1.5 text-xs font-medium rounded border ${activePreset === 'received' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                >
                  Полученные
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Магазин:</span>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="min-w-[120px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  aria-label="Фильтр по магазину"
                >
                  <option value="">Все</option>
                  {filterPlatformOptions.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                  {filterPlatformOptions.length === 0 && (
                    <option value="" disabled>Нет данных</option>
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Служба доставки:</span>
                <select
                  value={filterCarrier}
                  onChange={(e) => setFilterCarrier(e.target.value)}
                  className="min-w-[120px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                  aria-label="Фильтр по службе доставки"
                >
                  <option value="">Все</option>
                  {filterCarrierOptions.map(carrier => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                  ))}
                  {filterCarrierOptions.length === 0 && (
                    <option value="" disabled>Нет данных</option>
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span>Сортировка:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortByKey)}
                  className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  aria-label="Сортировка"
                >
                  <option value="date">Дата заказа</option>
                  <option value="protection">Окончание защиты</option>
                  <option value="platform">Магазин</option>
                  <option value="amount">Сумма</option>
                  <option value="status">Статус</option>
                  <option value="order_number">Номер заказа</option>
                  <option value="label">Название</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                  aria-label={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
                  title={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
                >
                  {sortDir === 'asc' ? '↑' : '↓'}
                </button>
              </label>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!hasActiveFilters}
              >
                Сбросить всё
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  aria-label="Показать архив"
                />
                <span>Показать архив</span>
              </label>
            </div>
          </div>

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
          {sortedOrderRows.length === 0 && filteredOrphanParcels.length === 0 && (
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

          {sortedOrderRows.map((row) => {
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {(row.order as { label?: string | null }).label || `${row.order.platform} #${row.order.order_number_external}`}
                      </span>
                      {orderIsArchived(row.order) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                          В архиве
                        </span>
                      )}
                      {((row.order as { label?: string | null }).label) && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {row.order.platform} #{row.order.order_number_external}
                        </span>
                      )}
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
                  {!orderIsArchived(row.order) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleArchiveOrder(row.order.id) }}
                      disabled={archivingOrderId === row.order.id}
                      className="ml-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                      aria-label="В архив"
                    >
                      {archivingOrderId === row.order.id ? '…' : 'В архив'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteOrder(row.order.id, row.order.platform, row.order.order_number_external) }}
                    disabled={deletingOrderId === row.order.id}
                    className="ml-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-50"
                    aria-label={`Удалить заказ ${row.order.platform} #${row.order.order_number_external}`}
                  >
                    {deletingOrderId === row.order.id ? '…' : 'Удалить'}
                  </button>
                </div>

                {/* Expanded: items + parcels */}
                {isExpanded && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/30 px-4 pb-3">
                    {/* Items */}
                    {row.items.length > 0 ? (
                      <div className="ml-8 space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-1">Товары</p>
                        {row.items.map(item => {
                          const inParcels = item.in_parcels && item.in_parcels.length > 0
                          const qtyDisplay = item.quantity_in_parcels != null
                            ? `${item.quantity_in_parcels}/${item.quantity_ordered}`
                            : `${item.quantity_received}/${item.quantity_ordered}`
                          return (
                          <div key={item.id} className="flex items-center gap-3 py-1 text-sm flex-wrap">
                            <span className="text-slate-700 dark:text-slate-300">{item.item_name}</span>
                            <span className="text-slate-400">{qtyDisplay}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              item.item_status === 'Dispute_Open' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {item.item_status.replace('_', ' ')}
                            </span>
                            {inParcels ? (
                              <span className="text-xs text-slate-400">
                                {item.in_parcels!.map(ip => (
                                  <span key={ip.parcel_id} className="mr-1">
                                    📦 {parcels.find(p => p.id === ip.parcel_id)?.tracking_number ?? ip.parcel_id.slice(0, 8)} ({ip.quantity})
                                  </span>
                                ))}
                              </span>
                            ) : item.parcel_id && (
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
                          )
                        })}
                      </div>
                    ) : (
                      <p className="ml-8 text-sm text-slate-400 py-1">Нет товаров. Добавьте товары в заказ.</p>
                    )}

                    {/* Parcels linked to this order */}
                    {row.parcels.length > 0 && (
                      <div className="ml-8 mt-2 space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Посылки</p>
                        {row.parcels.map(parcel => {
                          const itemsInParcel = row.items.filter(
                            i => i.in_parcels?.some(ip => ip.parcel_id === parcel.id) || i.parcel_id === parcel.id
                          ).map(i => {
                            const fromSplit = i.in_parcels?.find(ip => ip.parcel_id === parcel.id)
                            const qty = fromSplit?.quantity ?? (i.parcel_id === parcel.id ? i.quantity_ordered : 0)
                            return { name: i.item_name, quantity: qty }
                          })
                          return (
                            <div key={parcel.id} className="flex items-start gap-3 py-2 text-sm border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                                    {parcel.label || parcel.tracking_number}
                                  </span>
                                  {parcel.label && <span className="text-sm text-slate-500">{parcel.tracking_number}</span>}
                                  <span className="text-slate-500">{parcel.carrier_slug}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                  }`}>
                                    {parcel.status.replace('_', ' ')}
                                  </span>
                                  {parcelIsArchived(parcel) && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                                      В архиве
                                    </span>
                                  )}
                                </div>
                                {itemsInParcel.length > 0 ? (
                                  <p className="text-xs text-slate-500 mt-1">
                                    В посылке: {itemsInParcel.map(x => `${x.name} (${x.quantity})`).join(', ')}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 mt-1">Нет привязанных товаров</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/parcels/${parcel.id}/edit`) }}
                                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                >
                                  Ред.
                                </button>
                                {!parcelIsArchived(parcel) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleArchiveParcel(parcel.id) }}
                                    disabled={archivingParcelId === parcel.id}
                                    className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                                  >
                                    {archivingParcelId === parcel.id ? '…' : 'В архив'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteParcel(parcel.id) }}
                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Orphan parcels (not linked to any order) */}
          {filteredOrphanParcels.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  📦 Посылки без заказа ({filteredOrphanParcels.length})
                </p>
              </div>
              {filteredOrphanParcels.map(parcel => (
                <div key={parcel.id} className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="w-6 mr-2" />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {parcel.label || parcel.tracking_number}
                    </span>
                    {parcel.label && <span className="text-sm text-slate-500">{parcel.tracking_number}</span>}
                    <span className="text-sm text-slate-500">{parcel.carrier_slug}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {parcel.status.replace('_', ' ')}
                    </span>
                    {parcelIsArchived(parcel) && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                        В архиве
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/parcels/${parcel.id}/edit`)}
                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Ред.
                  </button>
                  {!parcelIsArchived(parcel) && (
                    <button
                      type="button"
                      onClick={() => handleArchiveParcel(parcel.id)}
                      disabled={archivingParcelId === parcel.id}
                      className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                    >
                      {archivingParcelId === parcel.id ? '…' : 'В архив'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteParcel(parcel.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                  >
                    Удалить
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
