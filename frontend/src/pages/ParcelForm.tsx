import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useParcels } from '../hooks/useParcels';
import { useOrders } from '../hooks/useOrders';
import { useOrderItems } from '../hooks/useOrderItems';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ParcelStatus, OrderItem } from '../types';

export function ParcelForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { parcels, createParcel, updateParcel, loading } = useParcels(true);
  const { orders } = useOrders();
  const { updateItem } = useOrderItems();

  const isEditMode = !!id;
  const existingParcel = isEditMode ? parcels.find(p => p.id === id) : null;

  // Form state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierSlug, setCarrierSlug] = useState('');
  const [status, setStatus] = useState<ParcelStatus>('Created');
  const [weightKg, setWeightKg] = useState('');

  // Items to link to this parcel
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect all unlinked order items (no parcel_id) + items already linked to this parcel
  const availableItems: (OrderItem & { orderPlatform: string; orderNumber: string })[] = [];
  for (const parcel of parcels) {
    const withItems = parcel as { order_items?: Array<Record<string, unknown>> };
    if (withItems.order_items) {
      for (const raw of withItems.order_items) {
        const parcelId = raw.parcel_id as string | null;
        // Show items that are unlinked OR linked to current parcel
        if (!parcelId || (isEditMode && parcelId === id)) {
          const order = orders.find(o => o.id === raw.order_id);
          availableItems.push({
            id: raw.id as string,
            order_id: raw.order_id as string,
            parcel_id: parcelId,
            item_name: raw.item_name as string,
            image_url: raw.image_url as string | null,
            tags: (raw.tags as string[]) || [],
            quantity_ordered: raw.quantity_ordered as number,
            quantity_received: raw.quantity_received as number,
            item_status: raw.item_status as OrderItem['item_status'],
            orderPlatform: order?.platform || '?',
            orderNumber: order?.order_number_external || '?',
          });
        }
      }
    }
  }

  useEffect(() => {
    if (existingParcel && isEditMode) {
      setTrackingNumber(existingParcel.tracking_number);
      setCarrierSlug(existingParcel.carrier_slug);
      setStatus(existingParcel.status);
      setWeightKg(existingParcel.weight_kg?.toString() || '');
      // Pre-select items already linked to this parcel
      const linked = new Set(availableItems.filter(i => i.parcel_id === id).map(i => i.id));
      setSelectedItemIds(linked);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingParcel, isEditMode]);

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parcelData = {
      tracking_number: trackingNumber,
      carrier_slug: carrierSlug,
      status,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
    };

    try {
      let parcelResult;
      if (isEditMode) {
        parcelResult = await updateParcel(id, parcelData);
      } else {
        parcelResult = await createParcel(parcelData);
      }

      if (parcelResult) {
        // Link selected items to this parcel
        for (const item of availableItems) {
          if (selectedItemIds.has(item.id) && item.parcel_id !== parcelResult.id) {
            // Link item to parcel
            await updateItem(item.id, { parcel_id: parcelResult.id });
          } else if (!selectedItemIds.has(item.id) && item.parcel_id === parcelResult.id) {
            // Unlink item from parcel
            await updateItem(item.id, { parcel_id: null });
          }
        }
        navigate('/');
      } else {
        setError('Не удалось сохранить посылку');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && isEditMode) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isEditMode ? 'Редактировать посылку' : 'Новая посылка'}
        </h1>
        <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
          Отмена
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="trackingNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Трек-номер *</label>
            <input type="text" id="trackingNumber" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required placeholder="1234567890CN" />
          </div>

          <div>
            <label htmlFor="carrier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Перевозчик *</label>
            <select id="carrier" value={carrierSlug} onChange={(e) => setCarrierSlug(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              <option value="">Выберите</option>
              <option value="cdek">CDEK</option>
              <option value="russian-post">Почта России</option>
              <option value="usps">USPS</option>
              <option value="dhl">DHL</option>
              <option value="fedex">FedEx</option>
              <option value="china-post">China Post</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Статус *</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ParcelStatus)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              <option value="Created">Создан</option>
              <option value="In_Transit">В пути</option>
              <option value="PickUp_Ready">Готов к выдаче</option>
              <option value="Delivered">Доставлен</option>
              <option value="Lost">Потерян</option>
              <option value="Archived">Архив</option>
            </select>
          </div>

          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Вес (кг)</label>
            <input type="number" id="weight" step="0.01" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" placeholder="Опционально" />
          </div>

          {/* Link items to this parcel */}
          {availableItems.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
                Привязать товары к посылке
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Выберите товары из заказов, которые находятся в этой посылке:
              </p>
              <div className="space-y-2">
                {availableItems.map(item => (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{item.item_name}</span>
                      <span className="text-slate-400 ml-2">x{item.quantity_ordered}</span>
                    </div>
                    <span className="text-xs text-slate-400">{item.orderPlatform} #{item.orderNumber}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
            {submitting ? 'Сохранение...' : isEditMode ? 'Обновить' : 'Создать посылку'}
          </button>
        </form>
      </div>
    </div>
  );
}
