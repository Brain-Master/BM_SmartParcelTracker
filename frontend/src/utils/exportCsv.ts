import type { ParcelRow } from '../types';

/**
 * Escape CSV field value (handle commas, quotes, and newlines)
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build flat CSV report from parcel rows
 * One row per order item
 */
export function buildFlatCsv(rows: ParcelRow[]): string {
  const headers = [
    'Date',
    'Order ID',
    'Item Name',
    'Tags',
    'Price (Original)',
    'Price (Base)',
    'Tracking',
    'Status',
  ];

  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    if (row.orderItems.length === 0) {
      // Parcel without order items - still show parcel data
      const csvRow = [
        '',
        '',
        '',
        '',
        '',
        '',
        escapeCsv(row.parcel.tracking_number),
        row.parcel.status,
      ];
      csvRows.push(csvRow.join(','));
    } else {
      // One CSV row per order item
      row.orderItems.forEach(item => {
        const order = row.order;
        const csvRow = [
          order?.order_date || '',
          order?.order_number_external || '',
          escapeCsv(item.item_name),
          escapeCsv(item.tags.join(', ')),
          order ? `${order.price_original} ${order.currency_original}` : '',
          order ? `${order.price_final_base} ${order.currency_original}` : '',
          escapeCsv(row.parcel.tracking_number),
          item.item_status,
        ];
        csvRows.push(csvRow.join(','));
      });
    }
  });

  // Add UTF-8 BOM for Excel compatibility
  return '\uFEFF' + csvRows.join('\n');
}

/**
 * Trigger CSV file download in browser
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
