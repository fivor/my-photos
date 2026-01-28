import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Lock } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'visitor' | 'admin'>('visitor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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
      login(data.token, data.role);
      navigate(data.role === 'admin' ? '/upload' : '/gallery');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-600 rounded-full">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-8">Access Photo Gallery</h2>
        
        <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md transition-colors ${role === 'visitor' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setRole('visitor')}
          >
            Visitor
          </button>
          <button
            className={`flex-1 py-2 rounded-md transition-colors ${role === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setRole('admin')}
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {role === 'admin' ? 'Admin Password' : 'Access Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-900/20 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Enter Gallery'}
          </button>
        </form>
      </div>
    </div>
  );
}
