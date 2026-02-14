import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useParcels } from '../hooks/useParcels';
import { useOrders } from '../hooks/useOrders';
import { useParcelItems } from '../hooks/useParcelItems';
import { useCarriers } from '../hooks/useCarriers';
import { getAvailableCarriersForForm } from '../utils/defaultCarriers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ParcelStatus, OrderItem } from '../types';

type OrderWithItems = { id: string; platform: string; order_number_external: string; order_items?: OrderItem[] };

export function ParcelForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { parcels, createParcel, updateParcel, loading } = useParcels();
  const { orders } = useOrders(true);
  const { carriers } = useCarriers();
  const availableCarriers = getAvailableCarriersForForm(carriers);
  const { list: listParcelItems, create: createParcelItem, update: updateParcelItem, remove: removeParcelItem, error: parcelItemsError } = useParcelItems();

  const isEditMode = !!id;
  const existingParcel = isEditMode ? parcels.find(p => p.id === id) : null;

  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierSlug, setCarrierSlug] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<ParcelStatus>('Created');
  const [weightKg, setWeightKg] = useState('');

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Map<string, number>>(new Map());
  const [currentParcelItems, setCurrentParcelItems] = useState<Map<string, { id: string; quantity: number }>>(new Map());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Items available to add: from (selected order or all) where remaining_quantity > 0 OR already in this parcel (when editing)
  const availableItems = useMemo(() => {
    const items: (OrderItem & { orderPlatform: string; orderNumber: string })[] = [];
    const orderList = orders as OrderWithItems[];
    for (const order of orderList) {
      const orderItems = order.order_items ?? [];
      for (const raw of orderItems) {
        const remaining = raw.remaining_quantity ?? (raw.quantity_ordered - (raw.quantity_in_parcels ?? 0));
        const inThisParcel = isEditMode && id && ((raw.in_parcels?.some(p => p.parcel_id === id) || raw.parcel_id === id) ?? false);
        if (remaining > 0 || inThisParcel) {
          items.push({
            ...raw,
            orderPlatform: order.platform || '?',
            orderNumber: order.order_number_external || '?',
          });
        }
      }
    }
    return items;
  }, [orders, isEditMode, id]);

  // Load existing parcel items when editing
  useEffect(() => {
    if (!isEditMode || !id) return;
    let cancelled = false;
    listParcelItems(id).then((list) => {
      if (cancelled) return;
      const map = new Map<string, { id: string; quantity: number }>();
      for (const pi of list) {
        map.set(pi.order_item_id, { id: pi.id, quantity: pi.quantity });
      }
      setCurrentParcelItems(map);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id]);

  useEffect(() => {
    if (existingParcel && isEditMode) {
      setTrackingNumber(existingParcel.tracking_number);
      setCarrierSlug(existingParcel.carrier_slug);
      setLabel((existingParcel as { label?: string | null }).label ?? '');
      setStatus(existingParcel.status);
      setWeightKg(existingParcel.weight_kg?.toString() || '');
    }
  }, [existingParcel, isEditMode]);

  // Pre-select items and quantities from current parcel items (after they're loaded)
  useEffect(() => {
    if (!isEditMode || !id || currentParcelItems.size === 0) return;
    const linked = new Set<string>();
    const quantities = new Map<string, number>();
    for (const [orderItemId, { quantity }] of currentParcelItems) {
      linked.add(orderItemId);
      quantities.set(orderItemId, quantity);
    }
    setSelectedItemIds(linked);
    setItemQuantities(quantities);
  }, [isEditMode, id, currentParcelItems]);

  const quantityInThisParcel = (item: OrderItem): number => {
    const fromParcelItems = currentParcelItems.get(item.id)?.quantity;
    if (typeof fromParcelItems === 'number') return fromParcelItems;
    const fromInParcels = id ? item.in_parcels?.find(p => p.parcel_id === id)?.quantity : undefined;
    if (typeof fromInParcels === 'number') return fromInParcels;
    if (id && item.parcel_id === id) return item.quantity_ordered;
    return 0;
  };

  const maxQuantityForItem = (item: OrderItem) => {
    const remaining = Number(item.remaining_quantity ?? item.quantity_ordered);
    return quantityInThisParcel(item) + remaining;
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setItemQuantities(q => { const m = new Map(q); m.delete(itemId); return m; });
      } else {
        const item = availableItems.find(i => i.id === itemId);
        if (item) {
          next.add(itemId);
          const defaultQty = Math.min(1, maxQuantityForItem(item));
          setItemQuantities(q => new Map(q).set(itemId, defaultQty));
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
      label: label.trim() || null,
      status,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
    };

    try {
      let parcelId: string;
      if (isEditMode) {
        const updated = await updateParcel(id, parcelData);
        if (!updated) {
          setError('Не удалось сохранить посылку');
          setSubmitting(false);
          return;
        }
        parcelId = updated.id;
      } else {
        const created = await createParcel(parcelData);
        if (!created) {
          setError('Не удалось сохранить посылку');
          setSubmitting(false);
          return;
        }
        parcelId = created.id;
      }

      // Sync parcel items via ParcelItem API (split shipments)
      for (const item of availableItems) {
        const wantedQty = selectedItemIds.has(item.id) ? (itemQuantities.get(item.id) ?? 1) : 0;
        const existing = currentParcelItems.get(item.id);

        if (wantedQty > 0) {
          if (existing) {
            if (existing.quantity !== wantedQty) {
              const { item: updated, error: updateErr } = await updateParcelItem(parcelId, existing.id, { quantity: wantedQty });
              if (!updated || updateErr) {
                setError(updateErr || parcelItemsError || 'Не удалось обновить количество (возможно, превышен заказ)');
                setSubmitting(false);
                return;
              }
            }
          } else {
            const { item: created, error: createErr } = await createParcelItem(parcelId, { order_item_id: item.id, quantity: wantedQty });
            if (!created || createErr) {
              setError(createErr || parcelItemsError || 'Не удалось добавить товар (проверьте остаток по заказу)');
              setSubmitting(false);
              return;
            }
          }
        } else if (existing) {
          const { ok: removed, error: removeErr } = await removeParcelItem(parcelId, existing.id);
          if (!removed || removeErr) {
            setError(removeErr || parcelItemsError || 'Не удалось убрать товар из посылки');
            setSubmitting(false);
            return;
          }
        }
      }

      navigate('/');
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
            <label htmlFor="parcelLabel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Название посылки</label>
            <input type="text" id="parcelLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например: Куртка DHL" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
          </div>

          {/* Перевозчик — из настроек (службы доставки) */}
          <div>
            <label htmlFor="carrier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Перевозчик *</label>
            <select id="carrier" value={carrierSlug} onChange={(e) => setCarrierSlug(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              <option value="">Выберите</option>
              {availableCarriers.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name !== c.slug ? `${c.slug} — ${c.name}` : c.slug}</option>
              ))}
              {availableCarriers.length === 0 && (
                <option value="" disabled>Включите службы в Настройках</option>
              )}
            </select>
            {availableCarriers.length === 0 && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">Настройки → Службы доставки: включите службы по умолчанию или добавьте свои</p>
            )}
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

          {availableItems.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">
                Привязать товары к посылке
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Выберите товары и укажите количество в этой посылке (остаток можно привязать к другой посылке):
              </p>
              <div className="space-y-2">
                {availableItems.map(item => {
                  const isSelected = selectedItemIds.has(item.id);
                  const quantity = itemQuantities.get(item.id) ?? 1;
                  const maxQty = maxQuantityForItem(item);
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
                          {(item.remaining_quantity ?? item.quantity_ordered) < item.quantity_ordered && (
                            <span className="text-slate-500 ml-1">(остаток: {item.remaining_quantity ?? 0})</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{item.orderPlatform} #{item.orderNumber}</span>
                      </label>
                      {isSelected && (
                        <div className="ml-8 mt-2 flex items-center gap-2">
                          <label className="text-xs text-slate-500">Кол-во в этой посылке:</label>
                          <input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={quantity}
                            onChange={(e) => updateItemQuantity(item.id, Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                          />
                          <span className="text-xs text-slate-400">макс. {maxQty}</span>
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
