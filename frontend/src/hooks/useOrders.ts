import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Order, OrderItem } from '../types';

interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export function useOrders(includeItems: boolean = false) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParam = includeItems ? '?include_items=true' : '';
      const data = await apiClient.get<OrderWithItems[]>(`/orders/${queryParam}`);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeItems]);

  const createOrder = async (orderData: Partial<Order>): Promise<Order | null> => {
    try {
      const newOrder = await apiClient.post<Order>('/orders/', orderData);
      setOrders([...orders, newOrder]);
      return newOrder;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      return null;
    }
  };

  const updateOrder = async (id: string, orderData: Partial<Order>): Promise<Order | null> => {
    try {
      const updated = await apiClient.put<Order>(`/orders/${id}`, orderData);
      setOrders(orders.map(o => o.id === id ? updated : o));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      return null;
    }
  };

  const deleteOrder = async (id: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/orders/${id}`);
      setOrders(orders.filter(o => o.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
      return false;
    }
  };

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
  };
}
