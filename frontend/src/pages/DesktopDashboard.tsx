/**
 * Desktop Command Center — Order-centric view.
 * Shows ALL orders (even without parcels), their items, and linked parcels.
 */
import { Fragment, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { useParcels } from '../hooks/useParcels'
import { useOrders } from '../hooks/useOrders'
import { useCurrentUser } from '../hooks/useUsers'
import type { OrderRow, Order, OrderItem, Parcel, ParcelStatus } from '../types'
import { ORDER_ITEM_STATUS_LABELS } from '../types'

const PROTECTION_DAYS_THRESHOLD = 7
type PresetKey = 'none' | 'lost' | 'protection' | 'pickup' | 'no_items' | 'orphans_only' | 'completed' | 'received'
type SortByKey = 'date' | 'protection' | 'platform' | 'amount' | 'status' | 'order_number' | 'label' | 'quantity' | 'weight' | 'archived' | 'parcels'
type ArchiveMode = 'active' | 'all' | 'archived'
type ViewMode = 'orders' | 'parcels' | 'items'
type ParcelGroupBy = 'none' | 'status' | 'carrier' | 'order'
type ItemGroupBy = 'none' | 'order' | 'platform' | 'status' | 'parcel'

const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  Created: 'Создана',
  In_Transit: 'В пути',
  PickUp_Ready: 'Готовы к получению',
  Delivered: 'Доставлено',
  Lost: 'Потеряно',
  Archived: 'В архиве',
}
// Порядок групп в виде «Статус»: готовы к получению → в пути → доставлено → потеряно → остальное → заказы без посылок
const STATUS_GROUP_ORDER: (ParcelStatus | 'NoParcels')[] = [
  'PickUp_Ready',
  'In_Transit',
  'Delivered',
  'Lost',
  'Created',
  'Archived',
  'NoParcels',
]

const PARCEL_STATUS_PRIORITY: Record<string, number> = {
  Lost: 6, In_Transit: 5, PickUp_Ready: 4, Delivered: 3, Archived: 2, Created: 1,
}

// Порядок сортировки по статусу для пользователя: готовы к получению → в пути → потеряно/создана → доставлено/архив
const STATUS_SORT_ORDER: Record<string, number> = {
  PickUp_Ready: 0,
  In_Transit: 1,
  Lost: 2,
  Created: 3,
  Delivered: 4,
  Archived: 5,
}
const statusSortIndex = (status: string) => STATUS_SORT_ORDER[status] ?? 99

function orderRowStatusSortIndex(row: OrderRow): number {
  if (row.parcels.length === 0) return 99
  return Math.min(...row.parcels.map(p => statusSortIndex(p.status)))
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
  const [searchParams, setSearchParams] = useSearchParams()
  useCurrentUser()
  const viewParam = searchParams.get('view')
  const variantParam = searchParams.get('variant')
  const viewMode: ViewMode = viewParam === 'parcels' ? 'parcels' : viewParam === 'items' ? 'items' : 'orders'
  const ordersViewVariant = variantParam === 'classic' ? 'classic' : 'table'
  const setViewMode = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams)
    next.set('view', mode)
    if (mode !== 'orders') next.delete('variant')
    else if (!next.has('variant')) next.set('variant', 'table')
    setSearchParams(next, { replace: true })
  }
  const setOrdersViewVariant = (variant: 'classic' | 'table') => {
    const next = new URLSearchParams(searchParams)
    next.set('view', 'orders')
    next.set('variant', variant)
    setSearchParams(next, { replace: true })
  }
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('active')
  const includeArchived = archiveMode === 'all' || archiveMode === 'archived'
  const archivedOnly = archiveMode === 'archived'
  // In Archive tab load all parcels (not archivedOnly) so archived orders can resolve their linked parcels (which may still be active).
  const { parcels, loading: parcelsLoading, error: parcelsError, refetch: refetchParcels, deleteParcel, archiveParcel, unarchiveParcel } = useParcels(false, includeArchived, archiveMode === 'archived' ? false : archivedOnly)
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders, deleteOrder, archiveOrder, unarchiveOrder } = useOrders(true, includeArchived, archivedOnly)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)
  const [archivingOrderId, setArchivingOrderId] = useState<string | null>(null)
  const [archivingParcelId, setArchivingParcelId] = useState<string | null>(null)
  const [unarchivingOrderId, setUnarchivingOrderId] = useState<string | null>(null)
  const [unarchivingParcelId, setUnarchivingParcelId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([])
  const [filterCarriers, setFilterCarriers] = useState<string[]>([])
  const [filterParcelStatuses, setFilterParcelStatuses] = useState<ParcelStatus[]>([])
  const [openHeaderFilter, setOpenHeaderFilter] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<PresetKey>('none')
  const [sortBy, setSortBy] = useState<SortByKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [parcelGroupBy, setParcelGroupBy] = useState<ParcelGroupBy>('none')
  const [parcelGroupCollapsed, setParcelGroupCollapsed] = useState<Record<string, boolean>>({})
  const [itemGroupBy, setItemGroupBy] = useState<ItemGroupBy>('none')
  const [itemGroupCollapsed, setItemGroupCollapsed] = useState<Record<string, boolean>>({})

  const handleSortColumn = (key: SortByKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      const defaultDesc = ['date', 'protection', 'amount', 'quantity', 'weight'] as const
      setSortDir(defaultDesc.includes(key as typeof defaultDesc[number]) ? 'desc' : 'asc')
    }
  }
  // Развёрнута ли карточка посылки в списке (parcel id → true)
  const [expandedParcelsInStatus, setExpandedParcelsInStatus] = useState<Record<string, boolean>>({})

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
    if (filterPlatforms.length > 0) {
      rows = rows.filter(row => filterPlatforms.includes(row.order.platform))
    }
    if (filterCarriers.length > 0) {
      rows = rows.filter(row => row.parcels.some(p => filterCarriers.includes(p.carrier_slug)))
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
        const sa = orderRowStatusSortIndex(a)
        const sb = orderRowStatusSortIndex(b)
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
      if (sortBy === 'archived') {
        const aa = !!(a.order as { is_archived?: boolean }).is_archived ? 1 : 0
        const ab = !!(b.order as { is_archived?: boolean }).is_archived ? 1 : 0
        return mult * (aa - ab)
      }
      return 0
    })
  }, [orderRows, searchQuery, filterPlatforms, filterCarriers, activePreset, sortBy, sortDir])

  const parcelIsArchived = (p: Parcel) => !!(p as { is_archived?: boolean }).is_archived

  // Parcels to use for stats/subtitle: respect archive mode (in "archived" tab API returns all parcels for resolution, so we filter client-side).
  const parcelsInCurrentMode = useMemo(() => {
    if (archiveMode === 'active') return parcels
    if (archiveMode === 'all') return parcels
    return parcels.filter(parcelIsArchived)
  }, [parcels, archiveMode])

  const filteredOrphanParcels = useMemo(() => {
    let list = orphanParcels
    if (archiveMode === 'archived') list = list.filter(parcelIsArchived)
    list = list.filter(p => parcelMatchesSearch(p, searchQuery))
    if (filterCarriers.length > 0) {
      list = list.filter(p => filterCarriers.includes(p.carrier_slug))
    }
    list = list.filter(p => parcelMatchesPreset(p, activePreset))
    if (filterPlatforms.length > 0) {
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
        return mult * (statusSortIndex(a.status) - statusSortIndex(b.status))
      }
      if (sortBy === 'order_number') {
        return mult * a.tracking_number.localeCompare(b.tracking_number)
      }
      if (sortBy === 'label') {
        return mult * (a.label ?? '').localeCompare(b.label ?? '')
      }
      return mult * a.tracking_number.localeCompare(b.tracking_number)
    })
  }, [orphanParcels, archiveMode, searchQuery, filterCarriers, filterPlatforms, activePreset, sortBy, sortDir])

  // Status view: группы по статусу посылки — список посылок; отдельно заказы без посылок.
  const filteredParcelsForStatus = useMemo(() => {
    let list = parcels
    list = list.filter(p => parcelMatchesSearch(p, searchQuery))
    if (filterCarriers.length > 0) list = list.filter(p => filterCarriers.includes(p.carrier_slug))
    if (filterParcelStatuses.length > 0) list = list.filter(p => filterParcelStatuses.includes(p.status))
    list = list.filter(p => parcelMatchesPreset(p, activePreset))
    return list
  }, [parcels, searchQuery, filterCarriers, filterParcelStatuses, activePreset])

  const statusParcelGroups = useMemo(() => {
    const groups: Record<ParcelStatus, Parcel[]> = {
      Created: [],
      In_Transit: [],
      PickUp_Ready: [],
      Delivered: [],
      Lost: [],
      Archived: [],
    }
    for (const p of filteredParcelsForStatus) {
      groups[p.status].push(p)
    }
    return groups
  }, [filteredParcelsForStatus])

  const ordersWithoutParcels = useMemo(
    () => sortedOrderRows.filter(row => row.parcels.length === 0),
    [sortedOrderRows]
  )

  // Для вида «Статус»: по id посылки — список { item, quantity, order } (товары в этой посылке и из какого заказа).
  const parcelToItemsAndOrders = useMemo(() => {
    const map = new Map<string, { item: OrderItem; quantity: number; order: Order }[]>()
    for (const row of orderRows) {
      for (const parcel of row.parcels) {
        let list = map.get(parcel.id)
        if (!list) {
          list = []
          map.set(parcel.id, list)
        }
        for (const item of row.items) {
          const inThis = item.in_parcels?.find(ip => ip.parcel_id === parcel.id)
          const qty = inThis?.quantity ?? (item.parcel_id === parcel.id ? item.quantity_ordered : 0)
          if (qty > 0) list.push({ item, quantity: qty, order: row.order })
        }
      }
    }
    return map
  }, [orderRows])

  // Вид «Посылки»: отфильтрованные и отсортированные посылки (все — и с заказами, и сироты).
  const sortedParcelsForView = useMemo(() => {
    const list = [...filteredParcelsForStatus]
    const mult = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (sortBy === 'status') return mult * (statusSortIndex(a.status) - statusSortIndex(b.status))
      if (sortBy === 'order_number' || sortBy === 'label') return mult * (a.tracking_number.localeCompare(b.tracking_number))
      if (sortBy === 'platform') return mult * a.carrier_slug.localeCompare(b.carrier_slug)
      if (sortBy === 'weight') {
        const wa = a.weight_kg ?? -Infinity
        const wb = b.weight_kg ?? -Infinity
        return mult * (wa - wb)
      }
      if (sortBy === 'archived') {
        const aa = parcelIsArchived(a) ? 1 : 0
        const ab = parcelIsArchived(b) ? 1 : 0
        return mult * (aa - ab)
      }
      return mult * a.tracking_number.localeCompare(b.tracking_number)
    })
  }, [filteredParcelsForStatus, sortBy, sortDir])

  // Группировка посылок по перевозчику (для вида «Посылки» с группировкой)
  const parcelsByCarrier = useMemo(() => {
    const map = new Map<string, Parcel[]>()
    for (const p of sortedParcelsForView) {
      const c = p.carrier_slug || ''
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(p)
    }
    return map
  }, [sortedParcelsForView])

  const carrierGroupKeys = useMemo(() => Array.from(parcelsByCarrier.keys()).sort((a, b) => a.localeCompare(b)), [parcelsByCarrier])

  // Группировка посылок по заказу (посылка может входить в несколько заказов)
  const parcelsByOrderGroups = useMemo(() => {
    const set = new Set(sortedParcelsForView.map(p => p.id))
    const groups: { key: string; label: string; parcels: Parcel[] }[] = []
    for (const row of sortedOrderRows) {
      const parcelsInOrder = row.parcels.filter(p => set.has(p.id))
      if (parcelsInOrder.length > 0) {
        groups.push({
          key: row.order.id,
          label: (row.order as { label?: string | null }).label || `${row.order.platform} #${row.order.order_number_external}`,
          parcels: parcelsInOrder,
        })
      }
    }
    groups.sort((a, b) => a.label.localeCompare(b.label))
    const linkedIds = new Set(sortedOrderRows.flatMap(row => row.parcels.map(p => p.id)))
    const noOrderParcels = sortedParcelsForView.filter(p => !linkedIds.has(p.id))
    if (noOrderParcels.length > 0) {
      groups.push({ key: 'no_order', label: 'Без заказа', parcels: noOrderParcels })
    }
    return groups
  }, [sortedParcelsForView, sortedOrderRows])

  // Вид «Товары»: плоский список позиций заказа с привязкой к заказу и посылкам.
  const itemsViewRaw = useMemo(() => {
    const flat: { item: OrderItem; order: Order; parcelQtys: { parcel: Parcel; quantity: number }[] }[] = []
    for (const row of orderRows) {
      for (const item of row.items) {
        const parcelQtys = row.parcels
          .filter(p => item.in_parcels?.some(ip => ip.parcel_id === p.id) || item.parcel_id === p.id)
          .map(p => ({
            parcel: p,
            quantity: item.in_parcels?.find(ip => ip.parcel_id === p.id)?.quantity ?? (item.parcel_id === p.id ? item.quantity_ordered : 0)
          }))
          .filter(pq => pq.quantity > 0)
        flat.push({ item, order: row.order, parcelQtys })
      }
    }
    return flat
  }, [orderRows])

  const sortedItemsView = useMemo(() => {
    let list = itemsViewRaw.filter(entry => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        if (entry.item.item_name.toLowerCase().includes(q)) return true
        if (entry.order.platform.toLowerCase().includes(q)) return true
        if (entry.order.order_number_external.toLowerCase().includes(q)) return true
        if (entry.parcelQtys.some(pq => pq.parcel.tracking_number.toLowerCase().includes(q))) return true
        if (entry.item.tags.some(t => t.toLowerCase().includes(q))) return true
        return false
      }
      return true
    })
    if (filterPlatforms.length > 0) list = list.filter(entry => filterPlatforms.includes(entry.order.platform))
    if (filterCarriers.length > 0) list = list.filter(entry => entry.parcelQtys.some(pq => filterCarriers.includes(pq.parcel.carrier_slug)))
    if (activePreset === 'lost') list = list.filter(entry => entry.parcelQtys.some(pq => pq.parcel.status === 'Lost'))
    if (activePreset === 'pickup') list = list.filter(entry => entry.parcelQtys.some(pq => pq.parcel.status === 'PickUp_Ready'))
    if (activePreset === 'completed' || activePreset === 'received') list = list.filter(entry => entry.parcelQtys.length > 0 && entry.parcelQtys.every(pq => pq.parcel.status === 'Delivered' || pq.parcel.status === 'Archived'))
    const mult = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortBy === 'date') return mult * (new Date(a.order.order_date).getTime() - new Date(b.order.order_date).getTime())
      if (sortBy === 'platform') return mult * a.order.platform.localeCompare(b.order.platform)
      if (sortBy === 'label') return mult * (a.item.item_name.localeCompare(b.item.item_name))
      if (sortBy === 'status') return mult * (String(a.item.item_status).localeCompare(String(b.item.item_status)))
      if (sortBy === 'quantity') return mult * ((a.item.quantity_ordered ?? 0) - (b.item.quantity_ordered ?? 0))
      if (sortBy === 'parcels') {
        const cmp = (a.parcelQtys.length - b.parcelQtys.length) || (a.parcelQtys[0]?.parcel.tracking_number ?? '').localeCompare(b.parcelQtys[0]?.parcel.tracking_number ?? '')
        return mult * cmp
      }
      return mult * (a.item.item_name.localeCompare(b.item.item_name))
    })
  }, [itemsViewRaw, searchQuery, filterPlatforms, filterCarriers, activePreset, sortBy, sortDir])

  type ItemViewEntry = { item: OrderItem; order: Order; parcelQtys: { parcel: Parcel; quantity: number }[] }
  // Группировка товаров для вида «Товары»
  const itemsByOrder = useMemo(() => {
    const map = new Map<string, ItemViewEntry[]>()
    for (const entry of sortedItemsView) {
      const id = entry.order.id
      if (!map.has(id)) map.set(id, [])
      map.get(id)!.push(entry)
    }
    return map
  }, [sortedItemsView])

  const itemsByPlatform = useMemo(() => {
    const map = new Map<string, ItemViewEntry[]>()
    for (const entry of sortedItemsView) {
      const p = entry.order.platform || ''
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(entry)
    }
    return map
  }, [sortedItemsView])

  const itemsByStatus = useMemo(() => {
    const map = new Map<string, ItemViewEntry[]>()
    for (const entry of sortedItemsView) {
      const s = String(entry.item.item_status ?? '')
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(entry)
    }
    return map
  }, [sortedItemsView])

  const itemStatusGroupKeys = useMemo(() => {
    const keys = Array.from(itemsByStatus.keys())
    const order = Object.keys(ORDER_ITEM_STATUS_LABELS) as (keyof typeof ORDER_ITEM_STATUS_LABELS)[]
    return keys.sort((a, b) => {
      const ia = order.indexOf(a as keyof typeof ORDER_ITEM_STATUS_LABELS)
      const ib = order.indexOf(b as keyof typeof ORDER_ITEM_STATUS_LABELS)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })
  }, [itemsByStatus])

  const itemsByParcelGroups = useMemo(() => {
    const parcelIds = new Set<string>()
    for (const entry of sortedItemsView) {
      for (const pq of entry.parcelQtys) parcelIds.add(pq.parcel.id)
    }
    const groups: { key: string; label: string; entries: ItemViewEntry[] }[] = []
    for (const parcelId of parcelIds) {
      const entries = sortedItemsView.filter(e => e.parcelQtys.some(pq => pq.parcel.id === parcelId))
      const parcel = entries[0]?.parcelQtys.find(pq => pq.parcel.id === parcelId)?.parcel
      groups.push({
        key: parcelId,
        label: parcel ? (parcel.label || parcel.tracking_number) : parcelId,
        entries,
      })
    }
    groups.sort((a, b) => a.label.localeCompare(b.label))
    const noParcel = sortedItemsView.filter(e => e.parcelQtys.length === 0)
    if (noParcel.length > 0) groups.push({ key: 'no_parcel', label: 'Без посылки', entries: noParcel })
    return groups
  }, [sortedItemsView])

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

  const handleUnarchiveOrder = async (orderId: string) => {
    setUnarchivingOrderId(orderId)
    const ok = await unarchiveOrder(orderId)
    setUnarchivingOrderId(null)
    if (ok) {
      refetchOrders()
      refetchParcels()
    }
  }

  const handleUnarchiveParcel = async (parcelId: string) => {
    setUnarchivingParcelId(parcelId)
    const ok = await unarchiveParcel(parcelId)
    setUnarchivingParcelId(null)
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
    setFilterPlatforms([])
    setFilterCarriers([])
    setFilterParcelStatuses([])
    setActivePreset('none')
    setSortBy('date')
    setSortDir('desc')
    setOpenHeaderFilter(null)
  }

  const hasActiveFilters = searchQuery.trim() !== '' || filterPlatforms.length > 0 || filterCarriers.length > 0 || filterParcelStatuses.length > 0 || activePreset !== 'none'
  const orderIsArchived = (order: Order) => !!(order as { is_archived?: boolean }).is_archived

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
    const price = typeof order.price_original === 'string' ? parseFloat(order.price_original) : (order.price_original ?? 0)
    const currency = order.currency_original ?? ''
    const symbol = currency ? getCurrencySymbol(currency) : '?'
    return `${Number(price).toFixed(0)} ${symbol}`
  }

  // Calculate total sums grouped by currency (since we can't reliably convert without knowing base currency at creation time)
  const totalsByCurrency = orderRows.reduce((totals, row) => {
    const order = row.order
    const currency = order.currency_original ?? '?'
    const price = typeof order.price_original === 'string'
      ? parseFloat(order.price_original)
      : (order.price_original || 0)
    if (!totals[currency]) totals[currency] = 0
    totals[currency] += price
    return totals
  }, {} as Record<string, number>)

  // Format totals as string (e.g. "10000 ₽ + 500 $ + 300 €")
  const totalSummary = Object.entries(totalsByCurrency)
    .map(([currency, total]) => `${total.toFixed(0)} ${getCurrencySymbol(currency)}`)
    .join(' + ') || '0'

  return (
    <div>
      {openHeaderFilter && <div className="fixed inset-0 z-[99]" onClick={() => setOpenHeaderFilter(null)} aria-hidden />}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Главная</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          {orderRows.length} заказов, {parcelsInCurrentMode.length} посылок
        </p>
        <div className="flex gap-1 mt-3" role="tablist" aria-label="Вид главной">
          {(['orders', 'parcels', 'items'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 border-b-transparent -mb-px'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {mode === 'orders' ? 'Заказы' : mode === 'parcels' ? 'Посылки' : 'Товары'}
            </button>
          ))}
        </div>
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
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{parcelsInCurrentMode.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🚚</span>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">В пути</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {parcelsInCurrentMode.filter(p => p.status === 'In_Transit').length}
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
              {(viewMode === 'orders' && ordersViewVariant === 'classic') && (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Сортировка по столбцу">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-1">Сортировка:</span>
                  {(['date', 'protection', 'platform', 'amount', 'status', 'order_number', 'label'] as const).map((key) => {
                    const labels: Record<typeof key, string> = { date: 'Дата', protection: 'Защита', platform: 'Магазин', amount: 'Сумма', status: 'Статус', order_number: 'Номер', label: 'Название' }
                    const active = sortBy === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSortColumn(key)}
                        className={`px-2.5 py-1.5 text-sm rounded border ${active ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        aria-pressed={active}
                        aria-label={active ? `Сортировка: ${labels[key]}, ${sortDir === 'asc' ? 'по возрастанию' : 'по убыванию'}. Нажмите для смены направления` : `Сортировать по ${labels[key]}`}
                      >
                        {labels[key]} {active && (sortDir === 'asc' ? '▲' : '▼')}
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!hasActiveFilters}
              >
                Сбросить всё
              </button>
              <div className="flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden" role="group" aria-label="Режим отображения: активные, все или архив">
                {(['active', 'all', 'archived'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setArchiveMode(mode)}
                    className={`px-3 py-1.5 text-sm font-medium border-r border-slate-300 dark:border-slate-600 last:border-r-0 ${
                      archiveMode === mode
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mode === 'active' ? 'Активные' : mode === 'all' ? 'Все' : 'Архив'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* View: Orders */}
          {viewMode === 'orders' && (
            <>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">Заказы</span>
            <div className="flex gap-2" role="group" aria-label="Вид списка заказов">
              <button
                type="button"
                onClick={() => setOrdersViewVariant('classic')}
                className={`px-3 py-1.5 text-sm rounded border ${ordersViewVariant === 'classic' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Классический вид (карточки)"
              >
                Классический вид
              </button>
              <button
                type="button"
                onClick={() => setOrdersViewVariant('table')}
                className={`px-3 py-1.5 text-sm rounded border ${ordersViewVariant === 'table' ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Мастер-таблица"
              >
                Мастер-таблица
              </button>
            </div>
          </div>

          {/* Orders: классический вид (архивный) */}
          {ordersViewVariant === 'classic' && (
            <>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Заказы и посылки</span>
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
              {archiveMode === 'archived' ? (
                <>
                  <p className="text-lg mb-2">Нет архивированных заказов</p>
                  <p className="text-sm">Архивировать можно из списка активных — кнопка «В архив» у заказа или посылки.</p>
                  <button
                    type="button"
                    onClick={() => setArchiveMode('active')}
                    className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
                  >
                    К активным
                  </button>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">Пока нет заказов</p>
                  <p className="text-sm">Создайте первый заказ, чтобы начать отслеживание</p>
                  <button
                    onClick={() => navigate('/orders/new')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Создать заказ
                  </button>
                </>
              )}
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
                  <div className="flex justify-center gap-1 shrink-0 min-w-[140px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/orders/${row.order.id}/edit`) }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Ред.
                    </button>
                    {!orderIsArchived(row.order) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleArchiveOrder(row.order.id) }}
                        disabled={archivingOrderId === row.order.id}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                        aria-label="В архив"
                      >
                        {archivingOrderId === row.order.id ? '…' : 'В архив'}
                      </button>
                    )}
                    {orderIsArchived(row.order) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleUnarchiveOrder(row.order.id) }}
                        disabled={unarchivingOrderId === row.order.id}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                        aria-label="Вернуть из архива"
                      >
                        {unarchivingOrderId === row.order.id ? '…' : 'Вернуть из архива'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteOrder(row.order.id, row.order.platform, row.order.order_number_external) }}
                      disabled={deletingOrderId === row.order.id}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-50"
                      aria-label={`Удалить заказ ${row.order.platform} #${row.order.order_number_external}`}
                    >
                      {deletingOrderId === row.order.id ? '…' : 'Удалить'}
                    </button>
                  </div>
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

                    {/* Cost breakdown */}
                    <div className="ml-8 mt-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Стоимость</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                        {(() => {
                          const itemsTotal = row.items.reduce(
                            (s, i) => s + ((Number(i.price_per_item) || 0) * (Number(i.quantity_ordered) || 0)),
                            0
                          )
                          const shipping = Number(row.order.shipping_cost) || 0
                          const customs = Number(row.order.customs_cost) || 0
                          const total =
                            typeof row.order.price_original === 'number' && !Number.isNaN(row.order.price_original)
                              ? row.order.price_original
                              : (parseFloat(String(row.order.price_original ?? '')) || itemsTotal + shipping + customs)
                          const symbol = getCurrencySymbol(row.order.currency_original ?? 'RUB')
                          const parts: string[] = []
                          if (itemsTotal > 0) parts.push(`Товары: ${itemsTotal.toFixed(2)} ${symbol}`)
                          if (shipping > 0) parts.push(`Доставка: ${shipping.toFixed(2)} ${symbol}`)
                          if (customs > 0) parts.push(`Пошлина: ${customs.toFixed(2)} ${symbol}`)
                          parts.push(`Итого: ${(Number(total) || 0).toFixed(2)} ${symbol}`)
                          return parts.join(' · ')
                        })()}
                      </p>
                      {row.order.price_final_base != null &&
                        row.order.currency_original !== 'RUB' &&
                        (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ≈ {Number(row.order.price_final_base).toFixed(2)} ₽
                          </p>
                        )}
                    </div>

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
                              <div className="flex justify-center gap-1 shrink-0 min-w-[140px]">
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
                                {parcelIsArchived(parcel) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleUnarchiveParcel(parcel.id) }}
                                    disabled={unarchivingParcelId === parcel.id}
                                    className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                                  >
                                    {unarchivingParcelId === parcel.id ? '…' : 'Вернуть из архива'}
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
                  <div className="flex justify-center gap-1 shrink-0 min-w-[140px]">
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
                    {parcelIsArchived(parcel) && (
                      <button
                        type="button"
                        onClick={() => handleUnarchiveParcel(parcel.id)}
                        disabled={unarchivingParcelId === parcel.id}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 disabled:opacity-50"
                      >
                        {unarchivingParcelId === parcel.id ? '…' : 'Вернуть из архива'}
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
                </div>
              ))}
          </div>
        )}
            </>
          )}

          {/* Orders: мастер-таблица */}
          {ordersViewVariant === 'table' && (
            <>
              {sortedOrderRows.length === 0 && filteredOrphanParcels.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  {archiveMode === 'archived' ? (
                    <>
                      <p className="text-lg mb-2">Нет архивированных заказов</p>
                      <button type="button" onClick={() => setArchiveMode('active')} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">К активным</button>
                    </>
                  ) : (
                    <>
                      <p className="text-lg mb-2">Пока нет заказов</p>
                      <button type="button" onClick={() => navigate('/orders/new')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Создать заказ</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Список заказов">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-8" scope="col" aria-label="Развернуть" />
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('date')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Дата {sortBy === 'date' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 relative">
                          <div className="flex justify-center"><div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => handleSortColumn('platform')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Магазин {sortBy === 'platform' && (sortDir === 'asc' ? '▲' : '▼')}</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenHeaderFilter(openHeaderFilter === 'orders-platform' ? null : 'orders-platform') }} className={`p-0.5 rounded ${openHeaderFilter === 'orders-platform' ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`} title="Фильтр" aria-label="Фильтр по магазину">▾</button>
                          </div></div>
                          {openHeaderFilter === 'orders-platform' && (
                            <div className="absolute left-0 top-full mt-0.5 z-[100] min-w-[160px] max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Магазин</p>
                              {filterPlatformOptions.length === 0 ? <span className="text-slate-500 text-sm">Нет данных</span> : filterPlatformOptions.map(platform => (
                                <label key={platform} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-1 py-0.5">
                                  <input type="checkbox" checked={filterPlatforms.length === 0 || filterPlatforms.includes(platform)} onChange={() => setFilterPlatforms(prev => prev.length === 0 ? filterPlatformOptions.filter(p => p !== platform) : prev.includes(platform) ? prev.length === 1 ? [] : prev.filter(p => p !== platform) : [...prev, platform])} className="rounded" />
                                  {platform}
                                </label>
                              ))}
                            </div>
                          )}
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('order_number')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Номер {sortBy === 'order_number' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('amount')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Сумма {sortBy === 'amount' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('protection')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Защита {sortBy === 'protection' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('status')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Статус {sortBy === 'status' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('archived')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Архив {sortBy === 'archived' && (sortDir === 'asc' ? '▲' : '▼')}</button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-36" scope="col">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedOrderRows.map((row) => {
                        const isExpanded = expandedOrders[row.order.id] ?? false
                        const worstParcel = row.parcels.length > 0 ? row.parcels.reduce((best, p) => (PARCEL_STATUS_PRIORITY[p.status] ?? 0) > (PARCEL_STATUS_PRIORITY[best.status] ?? 0) ? p : best, row.parcels[0]) : null
                        const statusLabel = worstParcel ? PARCEL_STATUS_LABELS[worstParcel.status] : '—'
                        return (
                          <Fragment key={row.order.id}>
                            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="px-4 py-2 text-center w-8">
                                <button type="button" onClick={() => toggleOrder(row.order.id)} className="text-slate-500 font-mono hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-expanded={isExpanded}>{isExpanded ? '−' : '+'}</button>
                              </td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{new Date(row.order.order_date).toLocaleDateString('ru-RU')}</td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{row.order.platform}</td>
                              <td className="px-4 py-2 text-center">
                                <button type="button" onClick={() => navigate(`/orders/${row.order.id}/edit`)} className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                                  {(row.order as { label?: string | null }).label || row.order.order_number_external}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{formatPrice(row.order)}</td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">
                                {row.order.protection_end_date ? (() => {
                                  const days = Math.ceil((new Date(row.order.protection_end_date).getTime() - Date.now()) / 86400000)
                                  const color = days >= 10 ? 'text-green-600' : days >= 5 ? 'text-yellow-600' : 'text-red-600'
                                  return <span className={color}>{days} дн.</span>
                                })() : '—'}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${worstParcel?.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : worstParcel?.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : worstParcel?.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{statusLabel}</span>
                              </td>
                              <td className="px-4 py-2 text-center">{orderIsArchived(row.order) ? <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span> : '—'}</td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  <button type="button" onClick={() => navigate(`/orders/${row.order.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Ред.</button>
                                  {!orderIsArchived(row.order) && <button type="button" onClick={() => handleArchiveOrder(row.order.id)} disabled={archivingOrderId === row.order.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>}
                                  {orderIsArchived(row.order) && <button type="button" onClick={() => handleUnarchiveOrder(row.order.id)} disabled={unarchivingOrderId === row.order.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>}
                                  <button type="button" onClick={() => handleDeleteOrder(row.order.id, row.order.platform, row.order.order_number_external)} disabled={deletingOrderId === row.order.id} className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400">Удалить</button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                <td colSpan={9} className="px-4 py-3 pl-12">
                                  <div className="space-y-3">
                                    {row.items.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Товары</p>
                                        <ul className="text-sm text-slate-700 dark:text-slate-300">
                                          {row.items.map(i => <li key={i.id}>{i.item_name} × {i.quantity_ordered}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                    {row.parcels.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Посылки</p>
                                        <ul className="text-sm space-y-1">
                                          {row.parcels.map(p => (
                                            <li key={p.id} className="flex items-center gap-2">
                                              <button type="button" onClick={() => navigate(`/parcels/${p.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">{p.label || p.tracking_number}</button>
                                              <span className="text-slate-500">{p.carrier_slug}</span>
                                              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : p.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{PARCEL_STATUS_LABELS[p.status]}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {filteredOrphanParcels.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                  <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10">
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">📦 Посылки без заказа ({filteredOrphanParcels.length})</p>
                  </div>
                  {filteredOrphanParcels.map(parcel => (
                    <div key={parcel.id} className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
                      <div className="flex-1 flex items-center gap-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{parcel.label || parcel.tracking_number}</span>
                        <span className="text-slate-500">{parcel.carrier_slug}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{PARCEL_STATUS_LABELS[parcel.status]}</span>
                        {parcelIsArchived(parcel) && <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span>}
                      </div>
                      <div className="flex justify-center gap-1 shrink-0 min-w-[140px]">
                        <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400">Ред.</button>
                        {!parcelIsArchived(parcel) && <button type="button" onClick={() => handleArchiveParcel(parcel.id)} disabled={archivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>}
                        {parcelIsArchived(parcel) && <button type="button" onClick={() => handleUnarchiveParcel(parcel.id)} disabled={unarchivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>}
                        <button type="button" onClick={() => handleDeleteParcel(parcel.id)} className="px-2 py-1 text-xs text-red-600 dark:text-red-400">Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
            </>
          )}

          {/* View: Parcels — мастер-таблица посылок (с опцией группировки) */}
          {viewMode === 'parcels' && (
            <>
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Посылки</span>
                <div className="flex items-center gap-2" role="group" aria-label="Группировка">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Группировать по:</span>
                  {(['none', 'status', 'carrier', 'order'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setParcelGroupBy(key)}
                      className={`px-2.5 py-1.5 text-sm rounded border ${parcelGroupBy === key ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                      aria-pressed={parcelGroupBy === key}
                    >
                      {key === 'none' ? 'Нет' : key === 'status' ? 'По статусу' : key === 'carrier' ? 'По перевозчику' : 'По заказу'}
                    </button>
                  ))}
                </div>
              </div>
              {sortedParcelsForView.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-lg mb-2">Нет посылок по выбранным фильтрам</p>
                  <button type="button" onClick={resetAllFilters} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">Сбросить фильтры</button>
                </div>
              ) : parcelGroupBy === 'none' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed" aria-label="Список посылок">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-8" scope="col" aria-label="Развернуть строку" />
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[18%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('order_number')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Трек {sortBy === 'order_number' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 relative w-[14%]">
                          <div className="flex justify-center"><div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => handleSortColumn('platform')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Перевозчик {sortBy === 'platform' && (sortDir === 'asc' ? '▲' : '▼')}</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenHeaderFilter(openHeaderFilter === 'parcels-carrier' ? null : 'parcels-carrier') }} className={`p-0.5 rounded ${openHeaderFilter === 'parcels-carrier' ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`} title="Фильтр" aria-label="Фильтр по перевозчику">▾</button>
                          </div></div>
                          {openHeaderFilter === 'parcels-carrier' && (
                            <div className="absolute left-0 top-full mt-0.5 z-[100] min-w-[160px] max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Перевозчик</p>
                              {filterCarrierOptions.length === 0 ? <span className="text-slate-500 text-sm">Нет данных</span> : filterCarrierOptions.map(carrier => (
                                <label key={carrier} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-1 py-0.5">
                                  <input type="checkbox" checked={filterCarriers.length === 0 || filterCarriers.includes(carrier)} onChange={() => setFilterCarriers(prev => prev.length === 0 ? filterCarrierOptions.filter(c => c !== carrier) : prev.includes(carrier) ? prev.length === 1 ? [] : prev.filter(c => c !== carrier) : [...prev, carrier])} className="rounded" />
                                  {carrier}
                                </label>
                              ))}
                            </div>
                          )}
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 relative w-[14%]">
                          <div className="flex justify-center"><div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => handleSortColumn('status')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Статус {sortBy === 'status' && (sortDir === 'asc' ? '▲' : '▼')}</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenHeaderFilter(openHeaderFilter === 'parcels-status' ? null : 'parcels-status') }} className={`p-0.5 rounded ${openHeaderFilter === 'parcels-status' ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`} title="Фильтр" aria-label="Фильтр по статусу">▾</button>
                          </div></div>
                          {openHeaderFilter === 'parcels-status' && (
                            <div className="absolute left-0 top-full mt-0.5 z-[100] min-w-[180px] max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Статус посылки</p>
                              {(['PickUp_Ready', 'In_Transit', 'Lost', 'Created', 'Delivered', 'Archived'] as ParcelStatus[]).map(status => (
                                <label key={status} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-1 py-0.5">
                                  <input type="checkbox" checked={filterParcelStatuses.length === 0 || filterParcelStatuses.includes(status)} onChange={() => setFilterParcelStatuses(prev => prev.length === 0 ? (['PickUp_Ready', 'In_Transit', 'Lost', 'Created', 'Delivered', 'Archived'] as ParcelStatus[]).filter(s => s !== status) : prev.includes(status) ? prev.length === 1 ? [] : prev.filter(s => s !== status) : [...prev, status])} className="rounded" />
                                  {PARCEL_STATUS_LABELS[status]}
                                </label>
                              ))}
                            </div>
                          )}
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('weight')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Вес {sortBy === 'weight' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('archived')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Архив {sortBy === 'archived' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-36" scope="col">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedParcelsForView.map((parcel) => {
                        const isParcelExpanded = expandedParcelsInStatus[parcel.id] ?? false
                        const details = parcelToItemsAndOrders.get(parcel.id) ?? []
                        return (
                          <Fragment key={parcel.id}>
                            <tr
                              key={parcel.id}
                              className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                            >
                              <td className="px-4 py-2 text-center w-8">
                                <button
                                  type="button"
                                  onClick={() => setExpandedParcelsInStatus(prev => ({ ...prev, [parcel.id]: !prev[parcel.id] }))}
                                  className="text-slate-500 font-mono hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                  aria-expanded={isParcelExpanded}
                                  aria-label={isParcelExpanded ? 'Свернуть содержимое посылки' : 'Развернуть содержимое посылки'}
                                >
                                  {isParcelExpanded ? '−' : '+'}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/parcels/${parcel.id}/edit`)}
                                  className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  {parcel.label || parcel.tracking_number}
                                </button>
                                {parcel.label && <span className="block text-xs text-slate-500">{parcel.tracking_number}</span>}
                              </td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.carrier_slug}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                  {PARCEL_STATUS_LABELS[parcel.status]}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.weight_kg != null ? `${parcel.weight_kg} кг` : '—'}</td>
                              <td className="px-4 py-2 text-center">
                                {parcelIsArchived(parcel) ? (
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Ред.</button>
                                  {!parcelIsArchived(parcel) && (
                                    <button type="button" onClick={() => handleArchiveParcel(parcel.id)} disabled={archivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>
                                  )}
                                  {parcelIsArchived(parcel) && (
                                    <button type="button" onClick={() => handleUnarchiveParcel(parcel.id)} disabled={unarchivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>
                                  )}
                                  <button type="button" onClick={() => handleDeleteParcel(parcel.id)} className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400">Удалить</button>
                                </div>
                              </td>
                            </tr>
                            {isParcelExpanded && (
                              <tr key={`${parcel.id}-exp`} className="bg-slate-50/50 dark:bg-slate-900/30">
                                <td colSpan={7} className="px-4 py-3 pl-12">
                                  {details.length > 0 ? (
                                    <>
                                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">В посылке (из заказов)</p>
                                      <div className="space-y-1">
                                        {details.map((d, idx) => (
                                          <div key={`${d.item.id}-${d.order.id}-${idx}`} className="flex items-center gap-2 text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">{d.item.item_name}</span>
                                            <span className="text-slate-400">×{d.quantity}</span>
                                            <span className="text-slate-500">— {(d.order as { label?: string | null }).label || `${d.order.platform} #${d.order.order_number_external}`}</span>
                                            <button type="button" onClick={() => navigate(`/orders/${d.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-sm text-slate-400">Нет привязанных товаров</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {parcelGroupBy === 'status' && (STATUS_GROUP_ORDER.filter((k): k is ParcelStatus => k !== 'NoParcels') as ParcelStatus[]).map((groupKey) => {
                    const parcelsInGroup = statusParcelGroups[groupKey] ?? []
                    if (parcelsInGroup.length === 0) return null
                    const isCollapsed = parcelGroupCollapsed[groupKey] ?? false
                    return (
                      <div key={groupKey} className="border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70"
                          onClick={() => setParcelGroupCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                          aria-expanded={!isCollapsed}
                        >
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {PARCEL_STATUS_LABELS[groupKey]} ({parcelsInGroup.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Посылки: ${PARCEL_STATUS_LABELS[groupKey]}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-8" scope="col" />
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[18%]">Трек</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Перевозчик</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Вес</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Архив</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-36" scope="col">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parcelsInGroup.map((parcel) => {
                                  const isParcelExpanded = expandedParcelsInStatus[parcel.id] ?? false
                                  const details = parcelToItemsAndOrders.get(parcel.id) ?? []
                                  return (
                                    <Fragment key={parcel.id}>
                                      <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-4 py-2 text-center w-8">
                                          <button type="button" onClick={() => setExpandedParcelsInStatus(prev => ({ ...prev, [parcel.id]: !prev[parcel.id] }))} className="text-slate-500 font-mono hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-expanded={isParcelExpanded} aria-label={isParcelExpanded ? 'Свернуть' : 'Развернуть'}>{isParcelExpanded ? '−' : '+'}</button>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">{parcel.label || parcel.tracking_number}</button>
                                          {parcel.label && <span className="block text-xs text-slate-500">{parcel.tracking_number}</span>}
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.carrier_slug}</td>
                                        <td className="px-4 py-2 text-center">
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{PARCEL_STATUS_LABELS[parcel.status]}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.weight_kg != null ? `${parcel.weight_kg} кг` : '—'}</td>
                                        <td className="px-4 py-2 text-center">{parcelIsArchived(parcel) ? <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span> : '—'}</td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Ред.</button>
                                            {!parcelIsArchived(parcel) && <button type="button" onClick={() => handleArchiveParcel(parcel.id)} disabled={archivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>}
                                            {parcelIsArchived(parcel) && <button type="button" onClick={() => handleUnarchiveParcel(parcel.id)} disabled={unarchivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>}
                                            <button type="button" onClick={() => handleDeleteParcel(parcel.id)} className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400">Удалить</button>
                                          </div>
                                        </td>
                                      </tr>
                                      {isParcelExpanded && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                          <td colSpan={7} className="px-4 py-3 pl-12">
                                            {details.length > 0 ? (
                                              <>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">В посылке (из заказов)</p>
                                                <div className="space-y-1">
                                                  {details.map((d, idx) => (
                                                    <div key={`${d.item.id}-${d.order.id}-${idx}`} className="flex items-center gap-2 text-sm">
                                                      <span className="text-slate-700 dark:text-slate-300">{d.item.item_name}</span>
                                                      <span className="text-slate-400">×{d.quantity}</span>
                                                      <span className="text-slate-500">— {(d.order as { label?: string | null }).label || `${d.order.platform} #${d.order.order_number_external}`}</span>
                                                      <button type="button" onClick={() => navigate(`/orders/${d.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </>
                                            ) : <p className="text-sm text-slate-400">Нет привязанных товаров</p>}
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {parcelGroupBy === 'carrier' && carrierGroupKeys.map((carrier) => {
                    const parcelsInGroup = parcelsByCarrier.get(carrier) ?? []
                    const isCollapsed = parcelGroupCollapsed[carrier] ?? false
                    return (
                      <div key={carrier} className="border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70"
                          onClick={() => setParcelGroupCollapsed(prev => ({ ...prev, [carrier]: !prev[carrier] }))}
                          aria-expanded={!isCollapsed}
                        >
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {carrier || '(без перевозчика)'} ({parcelsInGroup.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Посылки: ${carrier || 'без перевозчика'}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-8" scope="col" />
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[18%]">Трек</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Перевозчик</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Вес</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Архив</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-36" scope="col">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parcelsInGroup.map((parcel) => {
                                  const isParcelExpanded = expandedParcelsInStatus[parcel.id] ?? false
                                  const details = parcelToItemsAndOrders.get(parcel.id) ?? []
                                  return (
                                    <Fragment key={parcel.id}>
                                      <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-4 py-2 text-center w-8">
                                          <button type="button" onClick={() => setExpandedParcelsInStatus(prev => ({ ...prev, [parcel.id]: !prev[parcel.id] }))} className="text-slate-500 font-mono hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-expanded={isParcelExpanded} aria-label={isParcelExpanded ? 'Свернуть' : 'Развернуть'}>{isParcelExpanded ? '−' : '+'}</button>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">{parcel.label || parcel.tracking_number}</button>
                                          {parcel.label && <span className="block text-xs text-slate-500">{parcel.tracking_number}</span>}
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.carrier_slug}</td>
                                        <td className="px-4 py-2 text-center">
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{PARCEL_STATUS_LABELS[parcel.status]}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.weight_kg != null ? `${parcel.weight_kg} кг` : '—'}</td>
                                        <td className="px-4 py-2 text-center">{parcelIsArchived(parcel) ? <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span> : '—'}</td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Ред.</button>
                                            {!parcelIsArchived(parcel) && <button type="button" onClick={() => handleArchiveParcel(parcel.id)} disabled={archivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>}
                                            {parcelIsArchived(parcel) && <button type="button" onClick={() => handleUnarchiveParcel(parcel.id)} disabled={unarchivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>}
                                            <button type="button" onClick={() => handleDeleteParcel(parcel.id)} className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400">Удалить</button>
                                          </div>
                                        </td>
                                      </tr>
                                      {isParcelExpanded && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                          <td colSpan={7} className="px-4 py-3 pl-12">
                                            {details.length > 0 ? (
                                              <>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">В посылке (из заказов)</p>
                                                <div className="space-y-1">
                                                  {details.map((d, idx) => (
                                                    <div key={`${d.item.id}-${d.order.id}-${idx}`} className="flex items-center gap-2 text-sm">
                                                      <span className="text-slate-700 dark:text-slate-300">{d.item.item_name}</span>
                                                      <span className="text-slate-400">×{d.quantity}</span>
                                                      <span className="text-slate-500">— {(d.order as { label?: string | null }).label || `${d.order.platform} #${d.order.order_number_external}`}</span>
                                                      <button type="button" onClick={() => navigate(`/orders/${d.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </>
                                            ) : <p className="text-sm text-slate-400">Нет привязанных товаров</p>}
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {parcelGroupBy === 'order' && parcelsByOrderGroups.map((group) => {
                    const isCollapsed = parcelGroupCollapsed[group.key] ?? false
                    return (
                      <div key={group.key} className="border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70"
                          onClick={() => setParcelGroupCollapsed(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                          aria-expanded={!isCollapsed}
                        >
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {group.label} ({group.parcels.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Посылки: ${group.label}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-8" scope="col" />
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[18%]">Трек</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Перевозчик</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Вес</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[10%]">Архив</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-36" scope="col">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.parcels.map((parcel) => {
                                  const isParcelExpanded = expandedParcelsInStatus[parcel.id] ?? false
                                  const details = parcelToItemsAndOrders.get(parcel.id) ?? []
                                  return (
                                    <Fragment key={parcel.id}>
                                      <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-4 py-2 text-center w-8">
                                          <button type="button" onClick={() => setExpandedParcelsInStatus(prev => ({ ...prev, [parcel.id]: !prev[parcel.id] }))} className="text-slate-500 font-mono hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-expanded={isParcelExpanded} aria-label={isParcelExpanded ? 'Свернуть' : 'Развернуть'}>{isParcelExpanded ? '−' : '+'}</button>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="text-left font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">{parcel.label || parcel.tracking_number}</button>
                                          {parcel.label && <span className="block text-xs text-slate-500">{parcel.tracking_number}</span>}
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.carrier_slug}</td>
                                        <td className="px-4 py-2 text-center">
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${parcel.status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : parcel.status === 'In_Transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : parcel.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{PARCEL_STATUS_LABELS[parcel.status]}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{parcel.weight_kg != null ? `${parcel.weight_kg} кг` : '—'}</td>
                                        <td className="px-4 py-2 text-center">{parcelIsArchived(parcel) ? <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">В архиве</span> : '—'}</td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            <button type="button" onClick={() => navigate(`/parcels/${parcel.id}/edit`)} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Ред.</button>
                                            {!parcelIsArchived(parcel) && <button type="button" onClick={() => handleArchiveParcel(parcel.id)} disabled={archivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">В архив</button>}
                                            {parcelIsArchived(parcel) && <button type="button" onClick={() => handleUnarchiveParcel(parcel.id)} disabled={unarchivingParcelId === parcel.id} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 disabled:opacity-50">Вернуть</button>}
                                            <button type="button" onClick={() => handleDeleteParcel(parcel.id)} className="px-2 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400">Удалить</button>
                                          </div>
                                        </td>
                                      </tr>
                                      {isParcelExpanded && (
                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                          <td colSpan={7} className="px-4 py-3 pl-12">
                                            {details.length > 0 ? (
                                              <>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">В посылке (из заказов)</p>
                                                <div className="space-y-1">
                                                  {details.map((d, idx) => (
                                                    <div key={`${d.item.id}-${d.order.id}-${idx}`} className="flex items-center gap-2 text-sm">
                                                      <span className="text-slate-700 dark:text-slate-300">{d.item.item_name}</span>
                                                      <span className="text-slate-400">×{d.quantity}</span>
                                                      <span className="text-slate-500">— {(d.order as { label?: string | null }).label || `${d.order.platform} #${d.order.order_number_external}`}</span>
                                                      <button type="button" onClick={() => navigate(`/orders/${d.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </>
                                            ) : <p className="text-sm text-slate-400">Нет привязанных товаров</p>}
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* View: Items — плоский список позиций заказа (с опцией группировки) */}
          {viewMode === 'items' && (
            <>
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Товары</span>
                <div className="flex items-center gap-2" role="group" aria-label="Группировка товаров">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Группировать по:</span>
                  {(['none', 'order', 'platform', 'status', 'parcel'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setItemGroupBy(key)}
                      className={`px-2.5 py-1.5 text-sm rounded border ${itemGroupBy === key ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                      aria-pressed={itemGroupBy === key}
                    >
                      {key === 'none' ? 'Нет' : key === 'order' ? 'По заказу' : key === 'platform' ? 'По магазину' : key === 'status' ? 'По статусу' : 'По посылке'}
                    </button>
                  ))}
                </div>
              </div>
              {sortedItemsView.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-lg mb-2">Нет товаров по выбранным фильтрам</p>
                  <button type="button" onClick={resetAllFilters} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">Сбросить фильтры</button>
                </div>
              ) : itemGroupBy === 'none' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed" aria-label="Список товаров">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[24%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('label')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Товар {sortBy === 'label' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 relative w-[20%]">
                          <div className="flex justify-center"><div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => handleSortColumn('platform')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">Заказ {sortBy === 'platform' && (sortDir === 'asc' ? '▲' : '▼')}</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenHeaderFilter(openHeaderFilter === 'items-platform' ? null : 'items-platform') }} className={`p-0.5 rounded ${openHeaderFilter === 'items-platform' ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`} title="Фильтр" aria-label="Фильтр по заказу (магазину)">▾</button>
                          </div></div>
                          {openHeaderFilter === 'items-platform' && (
                            <div className="absolute left-0 top-full mt-0.5 z-[100] min-w-[160px] max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Магазин (заказ)</p>
                              {filterPlatformOptions.length === 0 ? <span className="text-slate-500 text-sm">Нет данных</span> : filterPlatformOptions.map(platform => (
                                <label key={platform} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-1 py-0.5">
                                  <input type="checkbox" checked={filterPlatforms.length === 0 || filterPlatforms.includes(platform)} onChange={() => setFilterPlatforms(prev => prev.length === 0 ? filterPlatformOptions.filter(p => p !== platform) : prev.includes(platform) ? prev.length === 1 ? [] : prev.filter(p => p !== platform) : [...prev, platform])} className="rounded" />
                                  {platform}
                                </label>
                              ))}
                            </div>
                          )}
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[12%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('quantity')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Кол-во {sortBy === 'quantity' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[22%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('parcels')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            В посылках {sortBy === 'parcels' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">
                          <div className="flex justify-center"><button type="button" onClick={() => handleSortColumn('status')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1">
                            Статус {sortBy === 'status' && (sortDir === 'asc' ? '▲' : '▼')}
                          </button></div>
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-24">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItemsView.map((entry) => (
                        <tr key={entry.item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-2 text-center">
                            <span className="text-slate-800 dark:text-slate-100">{entry.item.item_name}</span>
                            {entry.item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5 justify-center">
                                {entry.item.tags.map(t => (
                                  <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{t}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left">
                              {(entry.order as { label?: string | null }).label || `${entry.order.platform} #${entry.order.order_number_external}`}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">
                            {entry.item.quantity_in_parcels != null ? `${entry.item.quantity_in_parcels}/${entry.item.quantity_ordered}` : `${entry.item.quantity_received}/${entry.item.quantity_ordered}`}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">
                            {entry.parcelQtys.length > 0 ? (
                              <span className="text-xs">
                                {entry.parcelQtys.map(pq => (
                                  <span key={pq.parcel.id} className="mr-2">
                                    📦 {pq.parcel.tracking_number} ({pq.quantity})
                                  </span>
                                ))}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${entry.item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : entry.item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                              {ORDER_ITEM_STATUS_LABELS[entry.item.item_status] ?? entry.item.item_status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {itemGroupBy === 'order' && Array.from(itemsByOrder.entries())
                    .map(([orderId, entries]) => ({ key: orderId, label: (entries[0].order as { label?: string | null }).label || `${entries[0].order.platform} #${entries[0].order.order_number_external}`, entries }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map(({ key, label, entries }) => {
                      const isCollapsed = itemGroupCollapsed[key] ?? false
                      return (
                        <div key={key} className="border-b border-slate-200 dark:border-slate-700">
                          <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70" onClick={() => setItemGroupCollapsed(prev => ({ ...prev, [key]: !prev[key] }))} aria-expanded={!isCollapsed}>
                            <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                            {label} ({entries.length})
                          </button>
                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm table-fixed" aria-label={`Товары: ${label}`}>
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[24%]">Товар</th>
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[20%]">Заказ</th>
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[12%]">Кол-во</th>
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[22%]">В посылках</th>
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                    <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-24">Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map((entry) => (
                                    <tr key={entry.item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                      <td className="px-4 py-2 text-center"><span className="text-slate-800 dark:text-slate-100">{entry.item.item_name}</span>{entry.item.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5 justify-center">{entry.item.tags.map(t => <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{t}</span>)}</div>}</td>
                                      <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left">{(entry.order as { label?: string | null }).label || `${entry.order.platform} #${entry.order.order_number_external}`}</button></td>
                                      <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.item.quantity_in_parcels != null ? `${entry.item.quantity_in_parcels}/${entry.item.quantity_ordered}` : `${entry.item.quantity_received}/${entry.item.quantity_ordered}`}</td>
                                      <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.parcelQtys.length > 0 ? <span className="text-xs">{entry.parcelQtys.map(pq => <span key={pq.parcel.id} className="mr-2">📦 {pq.parcel.tracking_number} ({pq.quantity})</span>)}</span> : '—'}</td>
                                      <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${entry.item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : entry.item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{ORDER_ITEM_STATUS_LABELS[entry.item.item_status] ?? entry.item.item_status}</span></td>
                                      <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  {itemGroupBy === 'platform' && Array.from(itemsByPlatform.keys()).sort((a, b) => a.localeCompare(b)).map((platformKey) => {
                    const entries = itemsByPlatform.get(platformKey) ?? []
                    const isCollapsed = itemGroupCollapsed[platformKey] ?? false
                    return (
                      <div key={platformKey} className="border-b border-slate-200 dark:border-slate-700">
                        <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70" onClick={() => setItemGroupCollapsed(prev => ({ ...prev, [platformKey]: !prev[platformKey] }))} aria-expanded={!isCollapsed}>
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {platformKey || '(без магазина)'} ({entries.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Товары: ${platformKey}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[24%]">Товар</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[20%]">Заказ</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[12%]">Кол-во</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[22%]">В посылках</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-24">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entries.map((entry) => (
                                  <tr key={entry.item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-4 py-2 text-center"><span className="text-slate-800 dark:text-slate-100">{entry.item.item_name}</span>{entry.item.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5 justify-center">{entry.item.tags.map(t => <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{t}</span>)}</div>}</td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left">{(entry.order as { label?: string | null }).label || `${entry.order.platform} #${entry.order.order_number_external}`}</button></td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.item.quantity_in_parcels != null ? `${entry.item.quantity_in_parcels}/${entry.item.quantity_ordered}` : `${entry.item.quantity_received}/${entry.item.quantity_ordered}`}</td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.parcelQtys.length > 0 ? <span className="text-xs">{entry.parcelQtys.map(pq => <span key={pq.parcel.id} className="mr-2">📦 {pq.parcel.tracking_number} ({pq.quantity})</span>)}</span> : '—'}</td>
                                    <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${entry.item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : entry.item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{ORDER_ITEM_STATUS_LABELS[entry.item.item_status] ?? entry.item.item_status}</span></td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {itemGroupBy === 'status' && itemStatusGroupKeys.map((statusKey) => {
                    const entries = itemsByStatus.get(statusKey) ?? []
                    const isCollapsed = itemGroupCollapsed[statusKey] ?? false
                    const statusLabel = ORDER_ITEM_STATUS_LABELS[statusKey as keyof typeof ORDER_ITEM_STATUS_LABELS] ?? statusKey
                    return (
                      <div key={statusKey} className="border-b border-slate-200 dark:border-slate-700">
                        <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70" onClick={() => setItemGroupCollapsed(prev => ({ ...prev, [statusKey]: !prev[statusKey] }))} aria-expanded={!isCollapsed}>
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {statusLabel} ({entries.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Товары: ${statusLabel}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[24%]">Товар</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[20%]">Заказ</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[12%]">Кол-во</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[22%]">В посылках</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-24">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entries.map((entry) => (
                                  <tr key={entry.item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-4 py-2 text-center"><span className="text-slate-800 dark:text-slate-100">{entry.item.item_name}</span>{entry.item.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5 justify-center">{entry.item.tags.map(t => <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{t}</span>)}</div>}</td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left">{(entry.order as { label?: string | null }).label || `${entry.order.platform} #${entry.order.order_number_external}`}</button></td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.item.quantity_in_parcels != null ? `${entry.item.quantity_in_parcels}/${entry.item.quantity_ordered}` : `${entry.item.quantity_received}/${entry.item.quantity_ordered}`}</td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.parcelQtys.length > 0 ? <span className="text-xs">{entry.parcelQtys.map(pq => <span key={pq.parcel.id} className="mr-2">📦 {pq.parcel.tracking_number} ({pq.quantity})</span>)}</span> : '—'}</td>
                                    <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${entry.item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : entry.item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{ORDER_ITEM_STATUS_LABELS[entry.item.item_status] ?? entry.item.item_status}</span></td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {itemGroupBy === 'parcel' && itemsByParcelGroups.map((group) => {
                    const isCollapsed = itemGroupCollapsed[group.key] ?? false
                    return (
                      <div key={group.key} className="border-b border-slate-200 dark:border-slate-700">
                        <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/70" onClick={() => setItemGroupCollapsed(prev => ({ ...prev, [group.key]: !prev[group.key] }))} aria-expanded={!isCollapsed}>
                          <span className="w-5 text-slate-500 font-mono">{isCollapsed ? '+' : '−'}</span>
                          {group.label} ({group.entries.length})
                        </button>
                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm table-fixed" aria-label={`Товары: ${group.label}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80">
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[24%]">Товар</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[20%]">Заказ</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[12%]">Кол-во</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[22%]">В посылках</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-[14%]">Статус</th>
                                  <th className="text-center px-4 py-2 font-medium text-slate-700 dark:text-slate-300 w-24">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.entries.map((entry) => (
                                  <tr key={entry.item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-4 py-2 text-center"><span className="text-slate-800 dark:text-slate-100">{entry.item.item_name}</span>{entry.item.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5 justify-center">{entry.item.tags.map(t => <span key={t} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">#{t}</span>)}</div>}</td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left">{(entry.order as { label?: string | null }).label || `${entry.order.platform} #${entry.order.order_number_external}`}</button></td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.item.quantity_in_parcels != null ? `${entry.item.quantity_in_parcels}/${entry.item.quantity_ordered}` : `${entry.item.quantity_received}/${entry.item.quantity_ordered}`}</td>
                                    <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{entry.parcelQtys.length > 0 ? <span className="text-xs">{entry.parcelQtys.map(pq => <span key={pq.parcel.id} className="mr-2">📦 {pq.parcel.tracking_number} ({pq.quantity})</span>)}</span> : '—'}</td>
                                    <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${entry.item.item_status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : entry.item.item_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{ORDER_ITEM_STATUS_LABELS[entry.item.item_status] ?? entry.item.item_status}</span></td>
                                    <td className="px-4 py-2 text-center"><button type="button" onClick={() => navigate(`/orders/${entry.order.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">К заказу</button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
