import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useCurrentUser } from '../hooks/useUsers';
import { useOrderItems } from '../hooks/useOrderItems';
import { useParcels } from '../hooks/useParcels';
import { useStores } from '../hooks/useStores';
import { apiClient } from '../api/client';
import { getVisibleCurrencyOptions, CURRENCY_LABELS } from '../utils/currencyVisibility';
import { getAvailableStoresForForm } from '../utils/defaultStores';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { OrderItem, Parcel } from '../types';

interface NewItem {
  item_name: string;
  quantity_ordered: number;
  price_per_item: string;
}

export function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { orders, createOrder, updateOrder, loading } = useOrders(true);
  const { user } = useCurrentUser();
  const { createItem, deleteItem } = useOrderItems();
  const { parcels } = useParcels();
  const { stores } = useStores();
  const availableStores = getAvailableStoresForForm(stores);
  const visibleCurrencies = getVisibleCurrencyOptions();

  const isEditMode = !!id;
  const existingOrder = isEditMode ? orders.find(o => o.id === id) : null;

  // Form state
  const [platform, setPlatform] = useState('');
  const [orderNumberExternal, setOrderNumberExternal] = useState('');
  const [label, setLabel] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [protectionEndDate, setProtectionEndDate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [customsCost, setCustomsCost] = useState('');
  const [currencyOriginal, setCurrencyOriginal] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [comment, setComment] = useState('');
  const [manualRate, setManualRate] = useState(false);

  // Items state (for new order — added after creation; for edit — loaded from API)
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [existingItems, setExistingItems] = useState<OrderItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemTotalCost, setNewItemTotalCost] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default currency from user profile (только если валюта в списке видимых из Настроек)
  useEffect(() => {
    if (user && !currencyOriginal && !isEditMode && visibleCurrencies.length > 0) {
      const defaultCur = visibleCurrencies.includes(user.main_currency)
        ? user.main_currency
        : visibleCurrencies[0];
      setCurrencyOriginal(defaultCur);
    }
  }, [user, currencyOriginal, isEditMode, visibleCurrencies]);

  // Initialize form with existing order data in edit mode
  useEffect(() => {
    if (existingOrder && isEditMode) {
      setPlatform(existingOrder.platform);
      setOrderNumberExternal(existingOrder.order_number_external);
      setLabel((existingOrder as { label?: string | null }).label ?? '');
      setOrderDate(existingOrder.order_date.split('T')[0]);
      setProtectionEndDate(existingOrder.protection_end_date?.split('T')[0] || '');
      setShippingCost((existingOrder as { shipping_cost?: number }).shipping_cost != null ? String((existingOrder as { shipping_cost?: number }).shipping_cost) : '');
      setCustomsCost((existingOrder as { customs_cost?: number }).customs_cost != null ? String((existingOrder as { customs_cost?: number }).customs_cost) : '');
      setCurrencyOriginal(existingOrder.currency_original);
      setExchangeRate(existingOrder.exchange_rate_frozen.toString());
      setComment(existingOrder.comment || '');
      setManualRate(true);
    }
  }, [existingOrder, isEditMode]);

  // Load existing items in edit mode — items come from orders (include_items=true)
  useEffect(() => {
    if (isEditMode && id && existingOrder) {
      const orderWithItems = existingOrder as unknown as { order_items?: Array<Record<string, unknown>> };
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
      }));
      setExistingItems(items);
    }
  }, [isEditMode, id, existingOrder]);

  const itemsTotal = newItems.reduce((s, i) => s + (parseFloat(i.price_per_item) || 0) * (i.quantity_ordered || 0), 0)
    + existingItems.reduce((s, i) => s + (Number(i.price_per_item) || 0) * (i.quantity_ordered || 0), 0);
  const shipping = parseFloat(shippingCost) || 0;
  const customs = parseFloat(customsCost) || 0;
  const priceOriginal = itemsTotal + shipping + customs;

  // Auto-fetch exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      if (!user || manualRate || !currencyOriginal) return;
      if (currencyOriginal === user.main_currency) {
        setExchangeRate('1.0');
        return;
      }
      setFetchingRate(true);
      try {
        const result = await apiClient.get<{ rate: number }>(
          `/currency/rate?from_currency=${currencyOriginal}&to_currency=${user.main_currency}`
        );
        setExchangeRate(result.rate.toFixed(6));
      } catch {
        setExchangeRate('1.0');
      } finally {
        setFetchingRate(false);
      }
    };
    fetchRate();
  }, [currencyOriginal, user, manualRate]);

  const priceFinalBase = parseFloat((priceOriginal * (parseFloat(exchangeRate) || 1)).toFixed(2));

  const addNewItem = () => {
    if (!newItemName.trim()) return;
    setNewItems([...newItems, { item_name: newItemName.trim(), quantity_ordered: parseInt(newItemQty) || 1, price_per_item: newItemPrice }]);
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
    setNewItemTotalCost('');
  };

  // Auto-calculate when price or qty changes
  const handlePriceChange = (value: string) => {
    setNewItemPrice(value);
    const qty = parseFloat(newItemQty) || 0;
    const price = parseFloat(value) || 0;
    if (qty > 0 && price > 0) {
      setNewItemTotalCost((qty * price).toFixed(2));
    } else {
      setNewItemTotalCost('');
    }
  };

  const handleQtyChange = (value: string) => {
    setNewItemQty(value);
    const qty = parseFloat(value) || 0;
    const price = parseFloat(newItemPrice) || 0;
    const total = parseFloat(newItemTotalCost) || 0;
    
    // If we have total cost, recalculate price
    if (qty > 0 && total > 0 && !newItemPrice) {
      setNewItemPrice((total / qty).toFixed(2));
    }
    // If we have price, recalculate total
    else if (qty > 0 && price > 0) {
      setNewItemTotalCost((qty * price).toFixed(2));
    }
  };

  const handleTotalCostChange = (value: string) => {
    setNewItemTotalCost(value);
    const qty = parseFloat(newItemQty) || 0;
    const total = parseFloat(value) || 0;
    if (qty > 0 && total > 0) {
      setNewItemPrice((total / qty).toFixed(2));
    } else {
      setNewItemPrice('');
    }
  };

  const removeNewItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const removeExistingItem = async (itemId: string) => {
    const ok = await deleteItem(itemId);
    if (ok) {
      setExistingItems(existingItems.filter(i => i.id !== itemId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const orderData: Record<string, unknown> = {
      platform,
      order_number_external: orderNumberExternal,
      label: label.trim() || null,
      order_date: new Date(orderDate).toISOString(),
      protection_end_date: protectionEndDate ? new Date(protectionEndDate).toISOString() : null,
      currency_original: currencyOriginal,
      exchange_rate_frozen: manualRate && exchangeRate ? parseFloat(parseFloat(exchangeRate).toFixed(6)) : undefined,
      price_final_base: manualRate && exchangeRate ? parseFloat(priceFinalBase.toFixed(2)) : undefined,
      is_price_estimated: manualRate ? false : undefined,
      comment: comment || null,
      shipping_cost: shipping > 0 ? parseFloat(shipping.toFixed(2)) : null,
      customs_cost: customs > 0 ? parseFloat(customs.toFixed(2)) : null,
    };

    try {
      let result;
      if (isEditMode) {
        result = await updateOrder(id, orderData as Parameters<typeof updateOrder>[1]);
      } else {
        if (newItems.length > 0) {
          orderData.order_items = newItems.map((item) => ({
            item_name: item.item_name,
            quantity_ordered: item.quantity_ordered,
            price_per_item: item.price_per_item ? parseFloat(item.price_per_item) : null,
          }));
        } else {
          orderData.price_original = parseFloat(priceOriginal.toFixed(2));
        }
        result = await createOrder(orderData as Parameters<typeof createOrder>[0]);
      }

      if (result) {
        if (isEditMode && newItems.length > 0) {
          for (const item of newItems) {
            await createItem({
              order_id: id!,
              item_name: item.item_name,
              quantity_ordered: item.quantity_ordered,
              price_per_item: item.price_per_item ? parseFloat(item.price_per_item) : undefined,
            });
          }
        }
        navigate('/');
      } else {
        setError('Не удалось сохранить заказ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && isEditMode) return <LoadingSpinner />;

  const allParcels = parcels as Parcel[];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isEditMode ? 'Редактировать заказ' : 'Новый заказ'}
        </h1>
        <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
          Отмена
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Platform — из настроек (магазины) */}
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Площадка *</label>
            <select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              <option value="">Выберите площадку</option>
              {availableStores.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name !== s.slug ? `${s.slug} — ${s.name}` : s.slug}</option>
              ))}
              {availableStores.length === 0 && (
                <option value="" disabled>Включите площадки в Настройках</option>
              )}
            </select>
            {availableStores.length === 0 && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">Настройки → Магазины: включите площадки по умолчанию или добавьте свои</p>
            )}
          </div>

          {/* Order Number */}
          <div>
            <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Номер заказа *</label>
            <input type="text" id="orderNumber" value={orderNumberExternal} onChange={(e) => setOrderNumberExternal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required />
          </div>

          {/* Label — human-readable name */}
          <div>
            <label htmlFor="orderLabel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Название заказа</label>
            <input type="text" id="orderLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например: Куртка с Ozon" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="orderDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Дата заказа *</label>
              <input type="date" id="orderDate" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required />
            </div>
            <div>
              <label htmlFor="protectionDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Окончание защиты</label>
              <input type="date" id="protectionDate" value={protectionEndDate} onChange={(e) => setProtectionEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
            </div>
          </div>

          {/* Currency — только валюты, включённые в Настройках → Валюты и курсы */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Валюта *</label>
            <select id="currency" value={currencyOriginal} onChange={(e) => setCurrencyOriginal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              {visibleCurrencies.map((code) => (
                <option key={code} value={code}>{CURRENCY_LABELS[code] ?? code}</option>
              ))}
              {visibleCurrencies.length === 0 && (
                <option value="RUB">RUB (₽)</option>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Доставка</label>
              <input type="number" id="shipping" step="0.01" min="0" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
            </div>
            <div>
              <label htmlFor="customs" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Пошлины</label>
              <input type="number" id="customs" step="0.01" min="0" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Итого (товары + доставка + пошлины): {priceOriginal.toFixed(2)} {currencyOriginal}</p>

          {/* Exchange Rate */}
          {currencyOriginal && user && currencyOriginal !== user.main_currency && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Курс обмена</label>
              {!manualRate ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm">
                    {fetchingRate ? 'Загрузка курса...' : exchangeRate ? `1 ${currencyOriginal} = ${parseFloat(exchangeRate).toFixed(4)} ${user.main_currency} (ЦБ РФ)` : '—'}
                  </div>
                  <button type="button" onClick={() => setManualRate(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Указать вручную</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="number" step="0.000001" min="0" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
                  <button type="button" onClick={() => { setManualRate(false); setExchangeRate(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Авто-курс</button>
                </div>
              )}
              <p className="text-sm text-slate-500 mt-1">Итого: {priceFinalBase.toFixed(2)} {user.main_currency}</p>
            </div>
          )}

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Комментарий</label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
          </div>

          {/* === ITEMS SECTION === */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Товары</h3>

            {/* Existing items (edit mode) */}
            {existingItems.map(item => {
              const qtyDisplay = item.quantity_in_parcels != null
                ? `${item.quantity_in_parcels}/${item.quantity_ordered}`
                : `${item.quantity_received}/${item.quantity_ordered}`;
              const hasParcels = item.in_parcels && item.in_parcels.length > 0;
              return (
              <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-900 rounded flex-wrap">
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 min-w-0">{item.item_name}</span>
                <span className="text-sm text-slate-500">{qtyDisplay}</span>
                {item.price_per_item != null && (
                  <span className="text-sm text-slate-500">{Number(item.price_per_item).toFixed(2)}</span>
                )}
                {hasParcels ? (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {item.in_parcels!.map(ip => (
                      <span key={ip.parcel_id} className="mr-1">
                        📦 {allParcels.find(p => p.id === ip.parcel_id)?.tracking_number ?? ip.parcel_id.slice(0, 8)} ({ip.quantity})
                      </span>
                    ))}
                  </span>
                ) : item.parcel_id && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    📦 {allParcels.find(p => p.id === item.parcel_id)?.tracking_number || '—'}
                  </span>
                )}
                <button type="button" onClick={() => removeExistingItem(item.id)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
              </div>
              );
            })}

            {/* New items to add */}
            {newItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.item_name}</span>
                <span className="text-sm text-slate-500">x{item.quantity_ordered}</span>
                {item.price_per_item && <span className="text-sm text-slate-500">{parseFloat(item.price_per_item).toFixed(2)}</span>}
                <span className="text-xs text-green-600">новый</span>
                <button type="button" onClick={() => removeNewItem(i)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
              </div>
            ))}

            {/* Add item form */}
            <div className="space-y-2 mt-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Название товара"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewItem(); } }}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={newItemQty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    min="1"
                    placeholder="Кол-во"
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  />
                  <label className="text-xs text-slate-500">Кол-во</label>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Цена за шт"
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  />
                  <label className="text-xs text-slate-500">Цена за шт</label>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={newItemTotalCost}
                    onChange={(e) => handleTotalCostChange(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Стоимость"
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  />
                  <label className="text-xs text-slate-500">Стоимость</label>
                </div>
                <button type="button" onClick={addNewItem} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  +
                </button>
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
            {submitting ? 'Сохранение...' : isEditMode ? 'Обновить' : 'Создать заказ'}
          </button>
        </form>
      </div>
    </div>
  );
}
