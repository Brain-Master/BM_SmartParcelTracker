import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface Store {
  id: string;
  slug: string;
  name: string | null;
}

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Store[]>('/stores/');
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const createStore = async (data: { slug: string; name?: string | null }): Promise<Store | null> => {
    try {
      const created = await apiClient.post<Store>('/stores/', data);
      setStores((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create store');
      return null;
    }
  };

  const deleteStore = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      await apiClient.delete(`/stores/${id}`);
      setStores((prev) => prev.filter((s) => s.id !== id));
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить магазин';
      setError(message);
      return { ok: false, message };
    }
  };

  return {
    stores,
    loading,
    error,
    refetch: fetchStores,
    createStore,
    deleteStore,
  };
}
