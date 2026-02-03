import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthState {
  token: string | null;
  role: 'admin' | 'visitor' | null;
  isAuthenticated: boolean;
  login: (token: string, role: 'admin' | 'visitor', allowedFolders?: string[]) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [role, setRole] = useState<'admin' | 'visitor' | null>(() => {
     // Initial load role from token if valid
     const t = localStorage.getItem('token');
     if (t) {
        try {
           const decoded: any = jwtDecode(t);
           if (decoded.exp * 1000 > Date.now()) {
              return decoded.role;
           }
        } catch(e) {}
     }
     return null;
  });

  useEffect(() => {
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // check expiry
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          if (role !== decoded.role) {
             setRole(decoded.role);
          }
          // If we have allowedFolders in token, sync to localStorage just in case
          if (decoded.allowedFolders) {
            localStorage.setItem('allowedFolders', JSON.stringify(decoded.allowedFolders));
          }
        }
      } catch (e) {
        logout();
      }
    } else {
       setRole(null);
    }
  }, [token]);

  const login = (newToken: string, newRole: 'admin' | 'visitor', allowedFolders?: string[]) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setRole(newRole);
    if (allowedFolders) {
      localStorage.setItem('allowedFolders', JSON.stringify(allowedFolders));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('allowedFolders');
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
