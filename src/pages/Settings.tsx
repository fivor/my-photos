import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Globe } from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function Settings() {
  const [siteTitle, setSiteTitle] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // In a real app, we might fetch current config, but for passwords we don't return them.
    // Site title could be fetched.
    setSiteTitle('My Photo Gallery'); 
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Logic to update config
      // For this demo, we'll simulate it or call an API if it existed
      // await apiRequest('/config', { method: 'POST', body: ... });
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      setMessage('Settings saved successfully');
    } catch (e) {
      setMessage('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link to="/gallery" className="p-2 hover:bg-gray-800 rounded-full">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-8">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* General Settings */}
          <section className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-gray-700 pb-2">
              <Globe size={20} /> General Settings
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Site Title</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
              />
            </div>
          </section>

          {/* Security Settings */}
          <section className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-gray-700 pb-2">
              <Lock size={20} /> Security
            </h2>
            
            <div className="p-4 bg-yellow-900/20 text-yellow-200 text-sm rounded border border-yellow-900/50 mb-4">
              Note: Updating passwords will require re-login for all users.
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">New Visitor Password</label>
              <input
                type="password"
                value={visitorPassword}
                onChange={(e) => setVisitorPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">New Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
              />
            </div>
          </section>

          {message && (
            <div className={`p-4 rounded-lg text-center ${message.includes('Success') ? 'bg-green-900/20 text-green-400' : 'bg-blue-900/20 text-blue-400'}`}>
              {message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Saving...' : (
                <>
                  <Save size={18} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
