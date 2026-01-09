import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('emerald_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('emerald_refresh'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si tenemos access pero no refresh, forzar logout para evitar loops 401
    if (token && !refreshToken) {
      logout();
      return;
    }
    if (token && !user) {
      // Placeholder: could fetch /me when backend is ready
      setUser({ email: localStorage.getItem('emerald_email') || 'admin@emerald.com', role: 'admin' });
    }
  }, [token, refreshToken, user]);

  const login = async ({ email, password }) => {
    setLoading(true);
    setError(null);
    try {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);

      const { data } = await api.post('/v1/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const accessToken = data?.access_token;
      const nextRefresh = data?.refresh_token;
      if (accessToken) {
        localStorage.setItem('emerald_token', accessToken);
        localStorage.setItem('emerald_email', email);
        setToken(accessToken);
        setUser({ email, role: 'admin' });
      }
      if (nextRefresh) {
        localStorage.setItem('emerald_refresh', nextRefresh);
        setRefreshToken(nextRefresh);
      }
      return data;
    } catch (err) {
      console.error('Error al iniciar sesión', err);
      setError('No pudimos iniciar sesión. Verificá las credenciales.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('emerald_token');
    localStorage.removeItem('emerald_refresh');
    localStorage.removeItem('emerald_email');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      user,
      loading,
      error,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, refreshToken, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
};
