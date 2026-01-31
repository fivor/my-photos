import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { apiRequest } from '../utils/api';
import { Lock, Sun, Moon, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function Login() {
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'visitor' | 'admin'>('visitor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { t, siteTitle } = useConfig();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password, role }),
      });
      login(data.token, data.role, data.allowedFolders);
      navigate('/gallery');
    } catch (err: any) {
      setError(err.message || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 dark:opacity-20 blur-sm"></div>

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-white/20 dark:hover:bg-black/20 rounded-full text-gray-600 dark:text-gray-300 transition-colors backdrop-blur-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="w-full max-w-[400px] p-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50 z-10 mx-4">
        <div className="flex flex-col items-center mb-8">
          <img src="/confetti.png" alt="Logo" className="h-[60px] w-auto object-contain mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{siteTitle}</h2>
        </div>

        <div className="flex mb-6 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl">
          <button
            className={`flex-1 py-2 rounded-lg transition-all text-sm font-medium ${
              role === 'visitor' 
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => setRole('visitor')}
          >
            {t('login.visitor')}
          </button>
          <button
            className={`flex-1 py-2 rounded-lg transition-all text-sm font-medium ${
              role === 'admin' 
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => setRole('admin')}
          >
            {t('login.admin')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative group">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all pr-10"
                placeholder="请输入访问密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <div className="h-5 flex items-center justify-center">
              {error && (
                <span className="text-red-500 text-xs animate-pulse font-medium">
                  {error}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : t('login.button')}
          </button>
        </form>
      </div>
    </div>
  );
}
