/**
 * Carriers — службы доставки по умолчанию (вкл/выкл чекбоксами) + свои (API). Variant A: delete forbidden when parcels use carrier.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCarriers } from '../hooks/useCarriers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  DEFAULT_CARRIERS,
  loadCarrierVisibility,
  saveCarrierVisibility,
} from '../utils/defaultCarriers';

export function CarriersPage({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { carriers, loading, error, deleteCarrier, createCarrier, refetch } = useCarriers();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [visibleSlugs, setVisibleSlugs] = useState<string[]>(loadCarrierVisibility);

  const toggleDefault = (slug: string) => {
    const next = visibleSlugs.includes(slug)
      ? visibleSlugs.filter((s) => s !== slug)
      : [...visibleSlugs, slug];
    setVisibleSlugs(next);
    saveCarrierVisibility(next);
  };

  const handleDelete = async (id: string, slug: string) => {
    if (!window.confirm(`Удалить службу доставки «${slug}»?`)) return;
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteCarrier(id);
    setDeletingId(null);
    if (!result.ok && result.message) setDeleteError(result.message);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug.trim()) return;
    setDeleteError(null);
    const created = await createCarrier({ slug: newSlug.trim(), name: newName.trim() || null });
    if (created) {
      setNewSlug('');
      setNewName('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {!embedded && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Службы доставки</h1>
          <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
            Назад
          </button>
        </div>
      )}
      {loading && <LoadingSpinner />}
      {(error || deleteError) && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {deleteError || error}
        </div>
      )}
      {!loading && (
        <>
          {/* Службы по умолчанию — чекбоксы */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Службы доставки по умолчанию
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Включите те, с которыми планируете работать (API трекинга и т.д.). В форме посылки будут только включённые и ваши добавленные.
            </p>
            <ul className="space-y-2">
              {DEFAULT_CARRIERS.map((c) => (
                <li key={c.slug} className="flex items-center gap-2 py-1">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={visibleSlugs.includes(c.slug)}
                      onChange={() => toggleDefault(c.slug)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">({c.slug})</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Ваши службы доставки — API */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Ваши службы доставки
            </h2>
            <form onSubmit={handleCreate} className="flex gap-2 mb-4 flex-wrap">
              <input type="text" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Код (напр. DHL)" className="flex-1 min-w-[120px] px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название (необяз.)" className="flex-1 min-w-[120px] px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" />
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Добавить</button>
            </form>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Удаление запрещено, если есть посылки с этой службой. В таком случае появится уведомление.
            </p>
            <ul className="space-y-2">
              {carriers.length === 0 ? (
                <li className="text-slate-500 dark:text-slate-400">Нет своих служб. Добавьте выше.</li>
              ) : (
                carriers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.slug}</span>
                    {c.name && <span className="text-slate-500 dark:text-slate-400 text-sm">{c.name}</span>}
                    <button type="button" onClick={() => handleDelete(c.id, c.slug)} disabled={deletingId === c.id} className="px-2 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-50">
                      {deletingId === c.id ? '…' : 'Удалить'}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button type="button" onClick={() => refetch()} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">Обновить список</button>
          </div>
        </>
      )}
    </div>
  );
}
