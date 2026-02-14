import { useState } from 'react';
import { apiClient } from '../api/client';
import { OrderItem } from '../types';

export function useOrderItems() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createItem = async (data: {
    order_id: string;
    parcel_id?: string | null;
    item_name: string;
    quantity_ordered?: number;
    quantity_received?: number;
    item_status?: string;
    tags?: string[];
  }): Promise<OrderItem | null> => {
    setLoading(true);
    setError(null);
    try {
      const item = await apiClient.post<OrderItem>('/order-items/', {
        order_id: data.order_id,
        parcel_id: data.parcel_id || null,
        item_name: data.item_name,
        quantity_ordered: data.quantity_ordered ?? 1,
        quantity_received: data.quantity_received ?? 0,
        item_status: data.item_status ?? 'Waiting_Shipment',
        tags: data.tags ?? [],
      });
      return item;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (id: string, data: Partial<OrderItem>): Promise<OrderItem | null> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await apiClient.put<OrderItem>(`/order-items/${id}`, data);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/order-items/${id}`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, createItem, updateItem, deleteItem };
}
