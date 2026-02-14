import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface Carrier {
  id: string;
  slug: string;
  name: string | null;
}

export function useCarriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCarriers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Carrier[]>('/carriers/');
      setCarriers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch carriers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  const createCarrier = async (data: { slug: string; name?: string | null }): Promise<Carrier | null> => {
    try {
      const created = await apiClient.post<Carrier>('/carriers/', data);
      setCarriers((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create carrier');
      return null;
    }
  };

  const deleteCarrier = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      await apiClient.delete(`/carriers/${id}`);
      setCarriers((prev) => prev.filter((c) => c.id !== id));
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить службу доставки';
      setError(message);
      return { ok: false, message };
    }
  };

  return {
    carriers,
    loading,
    error,
    refetch: fetchCarriers,
    createCarrier,
    deleteCarrier,
  };
}
