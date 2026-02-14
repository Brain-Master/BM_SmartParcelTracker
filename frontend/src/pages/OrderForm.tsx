import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useCurrentUser } from '../hooks/useUsers';
import { apiClient } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { orders, createOrder, updateOrder, loading } = useOrders();
  const { user } = useCurrentUser();
  
  const isEditMode = !!id;
  const existingOrder = isEditMode ? orders.find(o => o.id === id) : null;

  // Form state
  const [platform, setPlatform] = useState('');
  const [orderNumberExternal, setOrderNumberExternal] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [protectionEndDate, setProtectionEndDate] = useState('');
  const [priceOriginal, setPriceOriginal] = useState('');
  const [currencyOriginal, setCurrencyOriginal] = useState('RUB');
  const [exchangeRate, setExchangeRate] = useState('');
  const [comment, setComment] = useState('');
  const [manualRate, setManualRate] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setManualRate(true); // In edit mode, always manual
    }
  }, [existingOrder, isEditMode]);

  // Auto-fetch exchange rate when currency changes (if not manual and not edit mode)
  useEffect(() => {
    const fetchRate = async () => {
      if (!user || manualRate || isEditMode || !priceOriginal) return;
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
      } catch (err) {
        console.error('Failed to fetch rate:', err);
        setExchangeRate('1.0'); // Fallback
      } finally {
        setFetchingRate(false);
      }
    };

    fetchRate();
  }, [currencyOriginal, user, manualRate, isEditMode, priceOriginal]);

  const priceFinalBase = (parseFloat(priceOriginal) || 0) * (parseFloat(exchangeRate) || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const orderData = {
      platform,
      order_number_external: orderNumberExternal,
      order_date: new Date(orderDate).toISOString(),
      protection_end_date: protectionEndDate ? new Date(protectionEndDate).toISOString() : null,
      price_original: parseFloat(priceOriginal),
      currency_original: currencyOriginal,
      // Only send exchange_rate if manual mode (otherwise backend auto-calculates)
      exchange_rate_frozen: manualRate && exchangeRate ? parseFloat(exchangeRate) : undefined,
      price_final_base: manualRate && exchangeRate ? priceFinalBase : undefined,
      is_price_estimated: manualRate ? false : undefined,
      comment: comment || null,
    };

    try {
      const result = isEditMode
        ? await updateOrder(id, orderData)
        : await createOrder(orderData);

      if (result) {
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

  if (loading && isEditMode) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isEditMode ? 'Редактировать заказ' : 'Новый заказ'}
        </h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          Отмена
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Platform */}
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Площадка *
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
            >
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
            <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Номер заказа *
            </label>
            <input
              type="text"
              id="orderNumber"
              value={orderNumberExternal}
              onChange={(e) => setOrderNumberExternal(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
            />
          </div>

          {/* Order Date */}
          <div>
            <label htmlFor="orderDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Дата заказа *
            </label>
            <input
              type="date"
              id="orderDate"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
            />
          </div>

          {/* Protection End Date */}
          <div>
            <label htmlFor="protectionDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Дата окончания защиты
            </label>
            <input
              type="date"
              id="protectionDate"
              value={protectionEndDate}
              onChange={(e) => setProtectionEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            />
          </div>

          {/* Price and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Стоимость *
              </label>
              <input
                type="number"
                id="price"
                step="0.01"
                min="0"
                value={priceOriginal}
                onChange={(e) => setPriceOriginal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Валюта *
              </label>
              <select
                id="currency"
                value={currencyOriginal}
                onChange={(e) => setCurrencyOriginal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                required
              >
                <option value="RUB">RUB (₽)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="CNY">CNY (¥)</option>
              </select>
            </div>
          </div>

          {/* Exchange Rate Preview / Manual Override */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Курс обмена
            </label>
            {!manualRate ? (
              <div className="space-y-2">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md">
                  {fetchingRate ? (
                    <span className="text-slate-500">Загрузка курса...</span>
                  ) : exchangeRate ? (
                    <span className="text-slate-700 dark:text-slate-300">
                      1 {currencyOriginal} = {parseFloat(exchangeRate).toFixed(4)} {user?.main_currency || 'RUB'}
                      <span className="text-xs text-slate-500 ml-2">(ЦБ РФ)</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setManualRate(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Указать курс вручную
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setManualRate(false);
                    setExchangeRate('');
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Использовать автоматический курс
                </button>
              </div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Итоговая сумма: {priceFinalBase.toFixed(2)} {user?.main_currency || 'RUB'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Комментарий
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            {submitting ? 'Сохранение...' : isEditMode ? 'Обновить' : 'Создать'}
          </button>
        </form>
      </div>
    </div>
  );
}
