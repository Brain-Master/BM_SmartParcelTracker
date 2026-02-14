import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { User, MainCurrency } from '../types';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const userData = await apiClient.get<User>('/users/me');
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const updateProfile = async (data: { email?: string; main_currency?: MainCurrency }): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await apiClient.put<User>('/users/me', data);
      setUser(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete('/users/me');
      setUser(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, refetch: fetchUser, updateProfile, deleteAccount };
}
