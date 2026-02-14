/**
 * Валюты и курсы — план §5 (минимальная реализация).
 * Список валют с чекбоксом «Показывать в приложении», кнопка «Обновить курсы», дата курса.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useUsers';
import { apiClient } from '../api/client';
import { CURRENCY_CODES, VISIBILITY_KEY, loadVisibility } from '../utils/currencyVisibility';

function saveVisibility(codes: string[]) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(codes));
}

export function CurrenciesPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [visible, setVisible] = useState<string[]>(loadVisibility);
  const [rates, setRates] = useState<Record<string, { rate: number; date: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCurrency = user?.main_currency ?? 'RUB';

  const toggleVisible = (code: string) => {
    const next = visible.includes(code) ? visible.filter((c) => c !== code) : [...visible, code];
    setVisible(next);
    saveVisibility(next);
  };

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    const next: Record<string, { rate: number; date: string }> = {};
    try {
      for (const code of CURRENCY_CODES) {
        if (code === baseCurrency) {
          next[code] = { rate: 1, date: new Date().toISOString() };
          continue;
        }
        const res = await apiClient.get<{ rate: number }>(
          `/currency/rate?from_currency=${code}&to_currency=${baseCurrency}`
        );
        next[code] = { rate: res.rate, date: new Date().toISOString() };
      }
      setRates(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить курсы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [baseCurrency]);

  return (
    <div className="max-w-2xl mx-auto">
      {!embedded && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Валюты и курсы</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
          >
            Назад
          </button>
        </div>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Источник: ЦБ РФ. В селектах заказа используются только валюты с включённой видимостью.
      </p>
      {error && (
        <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
          {error}
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-700 dark:text-slate-300">Базовая валюта: {baseCurrency}</span>
          <button
            type="button"
            onClick={fetchRates}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Загрузка...' : 'Обновить курсы'}
          </button>
        </div>
        <ul className="space-y-2">
          {CURRENCY_CODES.map((code) => (
            <li key={code} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible.includes(code)}
                  onChange={() => toggleVisible(code)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-800 dark:text-slate-200">{code}</span>
              </label>
              {rates[code] && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {rates[code].rate === 1 ? '—' : `1 ${code} = ${rates[code].rate.toFixed(4)} ${baseCurrency}`}
                  {' · '}
                  Курс на {new Date(rates[code].date).toLocaleDateString('ru-RU')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
