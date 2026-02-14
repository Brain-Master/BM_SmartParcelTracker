import { useState } from 'react';
import { apiClient } from '../api/client';
import { User } from '../types';

interface LoginCredentials {
  username: string; // email
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  main_currency?: 'RUB' | 'USD' | 'EUR';
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // OAuth2 password flow requires form data
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data: TokenResponse = await response.json();
      apiClient.setToken(data.access_token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<User | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const user = await apiClient.post<User>('/auth/register', data);
      return user;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiClient.setToken(null);
  };

  const isAuthenticated = (): boolean => {
    return apiClient.getToken() !== null;
  };

  return {
    login,
    register,
    logout,
    isAuthenticated,
    loading,
    error,
  };
}
