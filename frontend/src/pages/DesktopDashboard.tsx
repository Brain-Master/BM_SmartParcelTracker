/**
 * Desktop Command Center — §4.1
 * Master Table, filters (потеряшки, теги, ожидают действий), Export CSV.
 */
import { useMemo, useState } from 'react'
import { MasterTable } from '../components/MasterTable'
import { SummaryCards } from '../components/SummaryCards'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { useParcels } from '../hooks/useParcels'
import { useOrders } from '../hooks/useOrders'
import type { ParcelRow } from '../types'

interface Filters {
  lostParcels: boolean;
  actionRequired: boolean;
  selectedTag: string | null;
}

export function DesktopDashboard() {
  const { parcels, loading: parcelsLoading, error: parcelsError, refetch: refetchParcels } = useParcels(true)
  const { orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders()
  
  const [filters, setFilters] = useState<Filters>({
    lostParcels: false,
    actionRequired: false,
    selectedTag: null,
  })

  const rows: ParcelRow[] = useMemo(() => {
    return parcels.map(parcel => {
      // Extract order items from the parcel (if loaded via include_items)
      const parcelWithItems = parcel as { order_items?: Array<{
        id: string;
        order_id: string;
        parcel_id: string | null;
        item_name: string;
        image_url: string | null;
        tags: string[];
        quantity_ordered: number;
        quantity_received: number;
        item_status: import('../types').OrderItemStatus;
      }>};
      const orderItems = (parcelWithItems.order_items || []).map(item => ({
        ...item,
        item_status: item.item_status as import('../types').OrderItemStatus
      }));
      
      // Find the order by following the order_id from the first order item
      const order = orderItems.length > 0
        ? orders.find(o => o.id === orderItems[0].order_id)
        : undefined;
      
      return {
        parcel,
        orderItems,
        order,
      };
    });
  }, [parcels, orders])

  // Extract unique tags from all order items
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    rows.forEach(row => {
      row.orderItems.forEach(item => {
        item.tags.forEach(tag => tags.add(tag));
      });
    });
    return Array.from(tags).sort();
  }, [rows]);

  // Filter rows based on active filters
  const filteredRows = useMemo(() => {
    /* eslint-disable react-hooks/purity */
    const now = Date.now();
    /* eslint-enable react-hooks/purity */
    
    return rows.filter(row => {
      // Lost parcels filter
      if (filters.lostParcels) {
        const isLostStatus = row.parcel.status === 'In_Transit' || row.parcel.status === 'Created';
        if (!isLostStatus) return false;
        
        if (row.parcel.tracking_updated_at) {
          const daysSinceUpdate = Math.floor(
            (now - new Date(row.parcel.tracking_updated_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceUpdate <= 30) return false;
        }
      }
      
      // Action required filter
      if (filters.actionRequired) {
        let needsAction = false;
        
        // Check protection deadline
        if (row.order?.protection_end_date) {
          const daysUntil = Math.floor(
            (new Date(row.order.protection_end_date).getTime() - now) / (1000 * 60 * 60 * 24)
          );
          if (daysUntil < 5) needsAction = true;
        }
        
        // Check incomplete items
        const hasIncompleteItems = row.orderItems.some(
          item => item.quantity_received < item.quantity_ordered
        );
        if (hasIncompleteItems) needsAction = true;
        
        if (!needsAction) return false;
      }
      
      // Tag filter
      if (filters.selectedTag) {
        const hasTag = row.orderItems.some(item => 
          item.tags.includes(filters.selectedTag!)
        );
        if (!hasTag) return false;
      }
      
      return true;
    });
  }, [rows, filters])

  const loading = parcelsLoading || ordersLoading
  const error = parcelsError || ordersError

  const handleRetry = () => {
    refetchParcels()
    refetchOrders()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Главная
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Фильтры: {filteredRows.length} из {rows.length} посылок
        </p>
      </div>

      {/* Summary Cards */}
      {!loading && !error && <SummaryCards rows={rows} />}

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilters(prev => ({ ...prev, lostParcels: !prev.lostParcels }))}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            filters.lostParcels
              ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
          }`}
        >
          🚨 Потеряшки
        </button>
        
        <button
          onClick={() => setFilters(prev => ({ ...prev, actionRequired: !prev.actionRequired }))}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            filters.actionRequired
              ? 'bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
          }`}
        >
          ⚠️ Ожидают действий
        </button>
        
        {uniqueTags.length > 0 && (
          <select
            value={filters.selectedTag || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, selectedTag: e.target.value || null }))}
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <option value="">🏷️ Все теги</option>
            {uniqueTags.map(tag => (
              <option key={tag} value={tag}>#{tag}</option>
            ))}
          </select>
        )}
        
        {(filters.lostParcels || filters.actionRequired || filters.selectedTag) && (
          <button
            onClick={() => setFilters({ lostParcels: false, actionRequired: false, selectedTag: null })}
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            ✕ Сбросить фильтры
          </button>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {!loading && error && <ErrorMessage message={error} onRetry={handleRetry} />}
      {!loading && !error && <MasterTable rows={filteredRows} />}
    </div>
  )
}
