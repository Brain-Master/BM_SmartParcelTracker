import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Parcel } from '../types';

export function useParcels() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParcels = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Parcel[]>('/parcels/');
      setParcels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parcels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const createParcel = async (parcelData: Partial<Parcel>): Promise<Parcel | null> => {
    try {
      const newParcel = await apiClient.post<Parcel>('/parcels/', parcelData);
      setParcels([...parcels, newParcel]);
      return newParcel;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create parcel');
      return null;
    }
  };

  const updateParcel = async (id: string, parcelData: Partial<Parcel>): Promise<Parcel | null> => {
    try {
      const updated = await apiClient.put<Parcel>(`/parcels/${id}`, parcelData);
      setParcels(parcels.map(p => p.id === id ? updated : p));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update parcel');
      return null;
    }
  };

  const deleteParcel = async (id: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/parcels/${id}`);
      setParcels(parcels.filter(p => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete parcel');
      return false;
    }
  };

  return {
    parcels,
    loading,
    error,
    refetch: fetchParcels,
    createParcel,
    updateParcel,
    deleteParcel,
  };
}
