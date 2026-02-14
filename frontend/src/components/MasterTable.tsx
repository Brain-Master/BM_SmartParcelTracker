/**
 * Desktop Master Table — §4.1
 * Grouping: Parcel → OrderItems. TanStack Table, tags as pills, protection deadline colors.
 */
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import type { ParcelRow } from '../types'
import { buildFlatCsv, downloadCsv } from '../utils/exportCsv'

const tagPill =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags?.length) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={tagPill}>
          #{t}
        </span>
      ))}
    </div>
  )
}

function ProtectionCell({ endDate }: { endDate: string | null }) {
  /* eslint-disable react-hooks/purity -- days-left uses Date.now() intentionally */
  const days = useMemo(() => {
    if (!endDate) return null
    return Math.ceil(
      (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  }, [endDate])
  /* eslint-enable react-hooks/purity */
  if (!endDate || days === null) return <span className="text-slate-400">—</span>
  const cn =
    days >= 10
      ? 'deadline-ok'
      : days >= 5
        ? 'deadline-warn'
        : days >= 2
          ? 'deadline-urgent'
          : 'deadline-urgent'
  return <span className={cn}>{days} дн.</span>
}

export function MasterTable({ rows }: { rows: ParcelRow[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const handleExportCsv = () => {
    const csv = buildFlatCsv(rows);
    const filename = `parcels-export-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsv(csv, filename);
  };

  const columns = useMemo<ColumnDef<ParcelRow>[]>(
    () => [
      {
        id: 'expander',
        header: '',
        cell: ({ row }) =>
          row.original.orderItems.length > 0 &&
          !(row.original as ParcelRow & { _isItemRow?: boolean })._isItemRow ? (
            <button
              type="button"
              onClick={() => row.toggleExpanded()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  row.toggleExpanded()
                }
              }}
              aria-expanded={row.getIsExpanded()}
              aria-label={row.getIsExpanded() ? 'Свернуть товары' : 'Развернуть товары'}
              className="px-2 font-mono"
            >
              {row.getIsExpanded() ? '−' : '+'}
            </button>
          ) : null,
      },
      {
        id: 'tracking',
        header: 'Трек',
        cell: ({ row }) =>
          row.depth === 0
            ? row.original.parcel.tracking_number
            : row.original.orderItems[0]?.item_name ?? '—',
      },
      {
        id: 'carrier',
        header: 'Перевозчик / Теги',
        cell: ({ row }) =>
          row.depth === 0
            ? row.original.parcel.carrier_slug
            : <TagsCell tags={row.original.orderItems[0]?.tags ?? []} />,
      },
      {
        id: 'status',
        header: 'Статус',
        cell: ({ row }) =>
          row.depth === 0
            ? row.original.parcel.status
            : `${row.original.orderItems[0]?.quantity_received ?? 0}/${row.original.orderItems[0]?.quantity_ordered ?? 0}`,
      },
      {
        id: 'protection',
        header: 'Защита',
        cell: ({ row }) => {
          if (row.depth > 0) return null
          const order = row.original.order
          return (
            <ProtectionCell
              endDate={order?.protection_end_date ?? null}
            />
          )
        },
      },
    ],
    []
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API
  const table = useReactTable({
    data: rows,
    columns,
    state: { expanded },
    onExpandedChange: (updater) =>
      setExpanded((prev) => {
        const next: ExpandedState = typeof updater === 'function' ? updater(prev) : updater
        if (typeof next === 'boolean') return next ? prev : {}
        return next
      }),
    getRowId: (row, index, parent) =>
      parent
        ? `sub-${row.parcel.id}-${row.orderItems[0]?.id ?? index}`
        : `row-${row.parcel.id}-${index}`,
    getSubRows: (row) => {
      // Leaf rows (item-level) must not return subrows to avoid infinite recursion
      if ((row as ParcelRow & { _isItemRow?: boolean })._isItemRow) return undefined
      if (row.orderItems.length < 1) return undefined
      return row.orderItems.map((item) => ({
        parcel: row.parcel,
        orderItems: [item],
        order: row.order,
        _isItemRow: true as const,
      }))
    },
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <span className="font-medium">Заказы и посылки</span>
        <button
          type="button"
          onClick={handleExportCsv}
          aria-label="Скачать данные в формате CSV"
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500"
        >
          Скачать CSV
        </button>
      </div>
      <table 
        className="w-full text-left text-sm"
        aria-label="Таблица заказов и посылок"
      >
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-slate-200 dark:border-slate-700">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400"
                >
                  {typeof h.column.columnDef.header === 'string'
                    ? h.column.columnDef.header
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
