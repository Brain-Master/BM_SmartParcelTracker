import type { ParcelRow } from '../types';

interface SummaryCardsProps {
  rows: ParcelRow[];
}

export function SummaryCards({ rows }: SummaryCardsProps) {
  // Total parcels
  const totalParcels = rows.length;

  // In transit count
  const inTransit = rows.filter(row => row.parcel.status === 'In_Transit').length;

  // Lost parcels (In_Transit or Created with tracking_updated_at > 30 days or null)
  /* eslint-disable react-hooks/purity */
  const now = Date.now();
  /* eslint-enable react-hooks/purity */
  
  const lostParcels = rows.filter(row => {
    const isLostStatus = row.parcel.status === 'In_Transit' || row.parcel.status === 'Created';
    if (!isLostStatus) return false;
    
    if (!row.parcel.tracking_updated_at) return true;
    
    const daysSince = Math.floor(
      (now - new Date(row.parcel.tracking_updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince > 30;
  }).length;

  // Total sum of orders
  const totalSum = rows.reduce((sum, row) => {
    return sum + (row.order?.price_final_base || 0);
  }, 0);

  const cards = [
    {
      icon: '📦',
      label: 'Всего посылок',
      value: totalParcels,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: '🚚',
      label: 'В пути',
      value: inTransit,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      icon: '🚨',
      label: 'Потеряшки',
      value: lostParcels,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      icon: '💰',
      label: 'Сумма заказов',
      value: `${totalSum.toFixed(0)} ₽`,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`${card.bg} rounded-lg p-4 border border-slate-200 dark:border-slate-700`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{card.icon}</span>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {card.label}
              </p>
              <p className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
