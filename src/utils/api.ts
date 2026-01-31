// Use relative path to leverage Cloudflare Worker Routes on the same domain
// This avoids CORS and DNS issues if the domain is proxied
export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'https://api.fivor.de/api' : '/api');

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Add cache busting for GET requests
  let url = `${API_BASE}${endpoint}`;
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}_t=${Date.now()}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    // window.location.href = '/login'; // Let router handle redirect or throw error
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}
