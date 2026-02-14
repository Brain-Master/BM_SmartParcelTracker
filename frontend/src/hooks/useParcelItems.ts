import { useState } from 'react';
import { apiClient } from '../api/client';
import type { ParcelItem } from '../types';

const base = (parcelId: string) => `/parcels/${parcelId}/items`;

export function useParcelItems() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = async (parcelId: string): Promise<ParcelItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ParcelItem[]>(`${base(parcelId)}/`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parcel items');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const create = async (
    parcelId: string,
    data: { order_item_id: string; quantity: number }
  ): Promise<{ item: ParcelItem | null; error: string | null }> => {
    setLoading(true);
    setError(null);
    try {
      const item = await apiClient.post<ParcelItem>(`${base(parcelId)}/`, data);
      return { item, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add item to parcel';
      setError(msg);
      return { item: null, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const update = async (
    parcelId: string,
    parcelItemId: string,
    data: { quantity: number }
  ): Promise<{ item: ParcelItem | null; error: string | null }> => {
    setLoading(true);
    setError(null);
    try {
      const item = await apiClient.put<ParcelItem>(`${base(parcelId)}/${parcelItemId}`, data);
      return { item, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update parcel item';
      setError(msg);
      return { item: null, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const remove = async (parcelId: string, parcelItemId: string): Promise<{ ok: boolean; error: string | null }> => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`${base(parcelId)}/${parcelItemId}`);
      return { ok: true, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove item from parcel';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return { list, create, update, remove, loading, error };
}
