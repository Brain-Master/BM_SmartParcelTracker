import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useParcels } from '../hooks/useParcels';
import { useOrders } from '../hooks/useOrders';
import { useOrderItems } from '../hooks/useOrderItems';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ParcelStatus, OrderItem } from '../types';

export function ParcelForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { parcels, createParcel, updateParcel, loading } = useParcels();
  const { orders } = useOrders(true); // include items
  const { updateItem } = useOrderItems();

  const isEditMode = !!id;
  const existingParcel = isEditMode ? parcels.find(p => p.id === id) : null;

  // Form state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierSlug, setCarrierSlug] = useState('');
  const [status, setStatus] = useState<ParcelStatus>('Created');
  const [weightKg, setWeightKg] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Items to link to this parcel
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Map<string, number>>(new Map());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect all items from orders: unlinked (no parcel_id) + items already linked to this parcel
  const availableItems = useMemo(() => {
    const items: (OrderItem & { orderPlatform: string; orderNumber: string })[] = [];
    for (const order of orders) {
      const orderWithItems = order as unknown as { order_items?: Array<Record<string, unknown>> };
      if (orderWithItems.order_items) {
        for (const raw of orderWithItems.order_items) {
          const parcelId = raw.parcel_id as string | null;
          // Show items that are unlinked OR linked to current parcel
          if (!parcelId || (isEditMode && parcelId === id)) {
            items.push({
              id: raw.id as string,
              order_id: raw.order_id as string,
              parcel_id: parcelId,
              item_name: raw.item_name as string,
              image_url: raw.image_url as string | null,
              tags: (raw.tags as string[]) || [],
              quantity_ordered: raw.quantity_ordered as number,
              quantity_received: raw.quantity_received as number,
              item_status: raw.item_status as OrderItem['item_status'],
              orderPlatform: order.platform || '?',
              orderNumber: order.order_number_external || '?',
            });
          }
        }
      }
    }
    return items;
  }, [orders, isEditMode, id]);

  useEffect(() => {
    if (existingParcel && isEditMode) {
      setTrackingNumber(existingParcel.tracking_number);
      setCarrierSlug(existingParcel.carrier_slug);
      setStatus(existingParcel.status);
      setWeightKg(existingParcel.weight_kg?.toString() || '');
      setSelectedOrderId(existingParcel.order_id || '');
      // Pre-select items already linked to this parcel
      const linkedItems = availableItems.filter(i => i.parcel_id === id);
      const linked = new Set(linkedItems.map(i => i.id));
      setSelectedItemIds(linked);
      // Initialize quantities from quantity_received
      const quantities = new Map<string, number>();
      for (const item of linkedItems) {
        quantities.set(item.id, item.quantity_received || item.quantity_ordered);
      }
      setItemQuantities(quantities);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingParcel, isEditMode, availableItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        // Remove quantity
        setItemQuantities(q => {
          const newQ = new Map(q);
          newQ.delete(itemId);
          return newQ;
        });
      } else {
        next.add(itemId);
        // Initialize quantity to quantity_ordered
        const item = availableItems.find(i => i.id === itemId);
        if (item) {
          setItemQuantities(q => new Map(q).set(itemId, item.quantity_ordered));
        }
      }
      return next;
    });
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setItemQuantities(prev => new Map(prev).set(itemId, quantity));
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
      order_id: selectedOrderId || null,
    };

    try {
      let parcelResult;
      if (isEditMode) {
        parcelResult = await updateParcel(id, parcelData);
      } else {
        parcelResult = await createParcel(parcelData);
      }

      if (parcelResult) {
        // Link selected items to this parcel and set quantities
        for (const item of availableItems) {
          if (selectedItemIds.has(item.id) && item.parcel_id !== parcelResult.id) {
            const quantity = itemQuantities.get(item.id) || item.quantity_ordered;
            await updateItem(item.id, { 
              parcel_id: parcelResult.id,
              quantity_received: quantity 
            });
          } else if (!selectedItemIds.has(item.id) && item.parcel_id === parcelResult.id) {
            await updateItem(item.id, { 
              parcel_id: null,
              quantity_received: 0 
            });
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

          {/* Link to order */}
          <div>
            <label htmlFor="orderId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Привязать к заказу</label>
            <select id="orderId" value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
              <option value="">Без привязки к заказу</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.platform} — #{o.order_number_external}</option>
              ))}
            </select>
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
                {availableItems.map(item => {
                  const isSelected = selectedItemIds.has(item.id);
                  const quantity = itemQuantities.get(item.id) || item.quantity_ordered;
                  return (
                    <div key={item.id} className="p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(item.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{item.item_name}</span>
                          <span className="text-slate-400 ml-2">заказано: {item.quantity_ordered}</span>
                        </div>
                        <span className="text-xs text-slate-400">{item.orderPlatform} #{item.orderNumber}</span>
                      </label>
                      {isSelected && (
                        <div className="ml-8 mt-2 flex items-center gap-2">
                          <label className="text-xs text-slate-500">Кол-во в посылке:</label>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity_ordered}
                            value={quantity}
                            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
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
