import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useCurrentUser } from '../hooks/useUsers';
import { useOrderItems } from '../hooks/useOrderItems';
import { useParcels } from '../hooks/useParcels';
import { apiClient } from '../api/client';
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

  const isEditMode = !!id;
  const existingOrder = isEditMode ? orders.find(o => o.id === id) : null;

  // Form state
  const [platform, setPlatform] = useState('');
  const [orderNumberExternal, setOrderNumberExternal] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [protectionEndDate, setProtectionEndDate] = useState('');
  const [priceOriginal, setPriceOriginal] = useState('');
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

  // Set default currency from user profile
  useEffect(() => {
    if (user && !currencyOriginal && !isEditMode) {
      setCurrencyOriginal(user.main_currency);
    }
  }, [user, currencyOriginal, isEditMode]);

  // Initialize form with existing order data in edit mode
  useEffect(() => {
    if (existingOrder && isEditMode) {
      setPlatform(existingOrder.platform);
      setOrderNumberExternal(existingOrder.order_number_external);
      setOrderDate(existingOrder.order_date.split('T')[0]);
      setProtectionEndDate(existingOrder.protection_end_date?.split('T')[0] || '');
      setPriceOriginal(existingOrder.price_original.toString());
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
      }));
      setExistingItems(items);
    }
  }, [isEditMode, id, existingOrder]);

  // Auto-fetch exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      if (!user || manualRate || !priceOriginal || !currencyOriginal) return;
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
  }, [currencyOriginal, user, manualRate, priceOriginal]);

  const priceFinalBase = parseFloat(((parseFloat(priceOriginal) || 0) * (parseFloat(exchangeRate) || 1)).toFixed(2));

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

    const orderData = {
      platform,
      order_number_external: orderNumberExternal,
      order_date: new Date(orderDate).toISOString(),
      protection_end_date: protectionEndDate ? new Date(protectionEndDate).toISOString() : null,
      price_original: parseFloat(parseFloat(priceOriginal).toFixed(2)),
      currency_original: currencyOriginal,
      exchange_rate_frozen: manualRate && exchangeRate ? parseFloat(parseFloat(exchangeRate).toFixed(6)) : undefined,
      price_final_base: manualRate && exchangeRate ? parseFloat(priceFinalBase.toFixed(2)) : undefined,
      is_price_estimated: manualRate ? false : undefined,
      comment: comment || null,
    };

    try {
      let result;
      if (isEditMode) {
        result = await updateOrder(id, orderData);
      } else {
        result = await createOrder(orderData);
      }

      if (result) {
        // Create items for new order
        if (!isEditMode && newItems.length > 0) {
          for (const item of newItems) {
            const created = await createItem({
              order_id: result.id,
              item_name: item.item_name,
              quantity_ordered: item.quantity_ordered,
              price_per_item: item.price_per_item ? parseFloat(item.price_per_item) : undefined,
            });
          }
        }
        // Also create new items added in edit mode
        if (isEditMode && newItems.length > 0) {
          for (const item of newItems) {
            const created = await createItem({
              order_id: id,
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
          {/* Platform */}
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Площадка *</label>
            <select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
              <option value="">Выберите площадку</option>
              <option value="AliExpress">AliExpress</option>
              <option value="Ozon">Ozon</option>
              <option value="Wildberries">Wildberries</option>
              <option value="Amazon">Amazon</option>
              <option value="Other">Другое</option>
            </select>
          </div>

          {/* Order Number */}
          <div>
            <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Номер заказа *</label>
            <input type="text" id="orderNumber" value={orderNumberExternal} onChange={(e) => setOrderNumberExternal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required />
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

          {/* Price and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Стоимость *</label>
              <input type="number" id="price" step="0.01" min="0" value={priceOriginal} onChange={(e) => setPriceOriginal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Валюта *</label>
              <select id="currency" value={currencyOriginal} onChange={(e) => setCurrencyOriginal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" required>
                <option value="RUB">RUB (₽)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="CNY">CNY (¥)</option>
              </select>
            </div>
          </div>

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
            {existingItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.item_name}</span>
                <span className="text-sm text-slate-500">x{item.quantity_ordered}</span>
                {item.price_per_item != null && (
                  <span className="text-sm text-slate-500">{Number(item.price_per_item).toFixed(2)}</span>
                )}
                {item.parcel_id && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    📦 {allParcels.find(p => p.id === item.parcel_id)?.tracking_number || '—'}
                  </span>
                )}
                <button type="button" onClick={() => removeExistingItem(item.id)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
              </div>
            ))}

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
