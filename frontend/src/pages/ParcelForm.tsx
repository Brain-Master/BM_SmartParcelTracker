import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useParcels } from '../hooks/useParcels';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ParcelStatus } from '../types';

export function ParcelForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { parcels, createParcel, updateParcel, loading } = useParcels();
  
  const isEditMode = !!id;
  const existingParcel = isEditMode ? parcels.find(p => p.id === id) : null;

  // Form state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierSlug, setCarrierSlug] = useState('');
  const [status, setStatus] = useState<ParcelStatus>('Created');
  const [weightKg, setWeightKg] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with existing parcel data in edit mode
  useEffect(() => {
    if (existingParcel && isEditMode) {
      setTrackingNumber(existingParcel.tracking_number);
      setCarrierSlug(existingParcel.carrier_slug);
      setStatus(existingParcel.status);
      setWeightKg(existingParcel.weight_kg?.toString() || '');
    }
  }, [existingParcel, isEditMode]);

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
      const result = isEditMode
        ? await updateParcel(id, parcelData)
        : await createParcel(parcelData);

      if (result) {
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

  if (loading && isEditMode) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isEditMode ? 'Редактировать посылку' : 'Новая посылка'}
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
          {/* Tracking Number */}
          <div>
            <label htmlFor="trackingNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Трек-номер *
            </label>
            <input
              type="text"
              id="trackingNumber"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
              placeholder="Например: 1234567890CN"
            />
          </div>

          {/* Carrier */}
          <div>
            <label htmlFor="carrier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Перевозчик *
            </label>
            <select
              id="carrier"
              value={carrierSlug}
              onChange={(e) => setCarrierSlug(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
            >
              <option value="">Выберите перевозчика</option>
              <option value="cdek">CDEK</option>
              <option value="russian-post">Почта России</option>
              <option value="usps">USPS</option>
              <option value="dhl">DHL</option>
              <option value="fedex">FedEx</option>
              <option value="china-post">China Post</option>
              <option value="other">Другое</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Статус *
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ParcelStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              required
            >
              <option value="Created">Created (Создан)</option>
              <option value="In_Transit">In Transit (В пути)</option>
              <option value="PickUp_Ready">PickUp Ready (Готов к выдаче)</option>
              <option value="Delivered">Delivered (Доставлен)</option>
              <option value="Lost">Lost (Потерян)</option>
              <option value="Archived">Archived (Архив)</option>
            </select>
          </div>

          {/* Weight (optional) */}
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Вес (кг)
            </label>
            <input
              type="number"
              id="weight"
              step="0.01"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              placeholder="Опционально"
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
