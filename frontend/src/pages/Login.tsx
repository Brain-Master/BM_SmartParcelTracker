import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    
    // Email validation
    if (!email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Введите корректный email';
    }
    
    // Password validation
    if (!password) {
      errors.password = 'Пароль обязателен';
    } else if (password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const success = await login({ username: email, password });
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Вход
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Войдите в свой аккаунт для продолжения
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
              placeholder="your@email.com"
              autoComplete="email"
            />
            {validationErrors.email && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1" role="alert">
                {validationErrors.email}
              </p>
            )}
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {validationErrors.password && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1" role="alert">
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Backend error message */}
          {error && (
            <div
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              role="alert"
            >
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg
                     font-medium transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {/* Link to register */}
        <div className="mt-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Нет аккаунта?{' '}
            <Link
              to="/register"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
