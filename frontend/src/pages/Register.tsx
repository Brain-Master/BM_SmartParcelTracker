import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { MainCurrency } from '../types';

export function Register() {
  const navigate = useNavigate();
  const { register, login, loading, error } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mainCurrency, setMainCurrency] = useState<MainCurrency>('RUB');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {};
    
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
    
    // Confirm password validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Подтвердите пароль';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Register user
    const user = await register({
      email,
      password,
      main_currency: mainCurrency,
    });
    
    // If registration successful, auto-login
    if (user) {
      const loginSuccess = await login({ username: email, password });
      if (loginSuccess) {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Регистрация
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Создайте новый аккаунт для отслеживания посылок
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
              autoComplete="new-password"
            />
            {validationErrors.password && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1" role="alert">
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password field */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Подтвердите пароль
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {validationErrors.confirmPassword && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1" role="alert">
                {validationErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Main Currency field */}
          <div>
            <label
              htmlFor="mainCurrency"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Основная валюта
            </label>
            <select
              id="mainCurrency"
              value={mainCurrency}
              onChange={(e) => setMainCurrency(e.target.value as MainCurrency)}
              disabled={loading}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              <option value="RUB">₽ RUB (Российский рубль)</option>
              <option value="USD">$ USD (Доллар США)</option>
              <option value="EUR">€ EUR (Евро)</option>
            </select>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Валюта для отображения итоговых цен заказов
            </p>
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
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        {/* Link to login */}
        <div className="mt-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Уже есть аккаунт?{' '}
            <Link
              to="/login"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
