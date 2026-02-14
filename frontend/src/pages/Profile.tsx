import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { MainCurrency } from '../types';

export function Profile() {
  const navigate = useNavigate();
  const { user, loading, error, updateProfile, deleteAccount } = useCurrentUser();
  const { logout } = useAuth();
  
  // Initialize from user data once it loads
  const [email, setEmail] = useState('');
  const [mainCurrency, setMainCurrency] = useState<MainCurrency>('RUB');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form once when user data loads
  useEffect(() => {
    if (user && !initialized) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setEmail(user.email);
      setMainCurrency(user.main_currency);
      setInitialized(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [user, initialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const success = await updateProfile({
      email,
      main_currency: mainCurrency,
    });

    setSaving(false);

    if (success) {
      alert('Профиль обновлен!');
    } else {
      setSaveError('Не удалось обновить профиль');
    }
  };

  const handleDelete = async () => {
    const success = await deleteAccount();
    
    if (success) {
      logout();
      navigate('/register');
    } else {
      alert('Не удалось удалить аккаунт');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!user) return <ErrorMessage message="Пользователь не найден" />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Профиль
          </h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Назад
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Основная валюта
              </label>
              <select
                id="currency"
                value={mainCurrency}
                onChange={(e) => setMainCurrency(e.target.value as MainCurrency)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              >
                <option value="RUB">RUB (₽)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            {saveError && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                {saveError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              Опасная зона
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Удаление аккаунта необратимо. Все ваши данные будут удалены.
            </p>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Вы уверены? Это действие нельзя отменить.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  >
                    Да, удалить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
