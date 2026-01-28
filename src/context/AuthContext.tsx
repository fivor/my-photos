import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthState {
  token: string | null;
  role: 'admin' | 'visitor' | null;
  isAuthenticated: boolean;
  login: (token: string, role: 'admin' | 'visitor') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<'admin' | 'visitor' | null>(null);

  useEffect(() => {
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // check expiry
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setRole(decoded.role);
        }
      } catch (e) {
        logout();
      }
    }
  }, [token]);

  const login = (newToken: string, newRole: 'admin' | 'visitor') => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setRole(newRole);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
