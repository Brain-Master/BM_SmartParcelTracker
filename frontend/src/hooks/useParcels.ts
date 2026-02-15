import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Parcel, OrderItem } from '../types';

interface ParcelWithItems extends Parcel {
  order_items?: OrderItem[];
}

export function useParcels(
  includeItems: boolean = false,
  includeArchived: boolean = false,
  archivedOnly: boolean = false
) {
  const [parcels, setParcels] = useState<ParcelWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParcels = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeItems) params.set('include_items', 'true');
      if (archivedOnly) {
        params.set('include_archived', 'true');
        params.set('archived_only', 'true');
      } else if (includeArchived) {
        params.set('include_archived', 'true');
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiClient.get<ParcelWithItems[]>(`/parcels/${query}`);
      setParcels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parcels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeItems, includeArchived, archivedOnly]);

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

  const archiveParcel = async (id: string): Promise<boolean> => {
    try {
      const updated = await apiClient.put<Parcel>(`/parcels/${id}`, { is_archived: true });
      setParcels(parcels.map(p => (p.id === id ? { ...p, ...updated } : p)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive parcel');
      return false;
    }
  };

  const unarchiveParcel = async (id: string): Promise<boolean> => {
    try {
      const updated = await apiClient.put<Parcel>(`/parcels/${id}`, { is_archived: false });
      setParcels(parcels.map(p => (p.id === id ? { ...p, ...updated } : p)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive parcel');
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
    archiveParcel,
    unarchiveParcel,
  };
}
