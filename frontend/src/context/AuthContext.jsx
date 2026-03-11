import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('emerald_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('emerald_refresh'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isTokenExpired = (accessToken) => {
    try {
      const payload = accessToken.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      if (!decoded?.exp) {
        return false;
      }
      return Date.now() >= decoded.exp * 1000;
    } catch (err) {
      return true;
    }
  };

  // Decodificar JWT para obtener user info
  const decodeToken = (accessToken) => {
    try {
      const payload = accessToken.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return {
        id: parseInt(decoded.sub, 10),
        email: decoded.email,
        username: decoded.username,
        is_superuser: decoded.is_superuser,
        role: decoded.role,
        full_name: localStorage.getItem('emerald_full_name') || decoded.email,
      };
    } catch (err) {
      console.error('Error decodificando token:', err);
      return null;
    }
  };

  useEffect(() => {
    // Sincronizar localStorage entre pestañas
    const handleStorageChange = (e) => {
      if (e.key === 'emerald_token' && e.newValue !== token) {
        setToken(e.newValue);
      }
      if (e.key === 'emerald_refresh' && e.newValue !== refreshToken) {
        setRefreshToken(e.newValue);
      }
      // Si se borra el token desde otra pestaña, hacer logout
      if (e.key === 'emerald_token' && !e.newValue) {
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token, refreshToken]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    const decodedUser = decodeToken(token);
    if (!decodedUser) {
      // Token corrupto/inválido: cerrar sesión por seguridad.
      logout();
      return;
    }

    if (!user || user.id !== decodedUser.id) {
      setUser(decodedUser);
    }

    // Solo cerrar sesión por ausencia de refresh cuando el access token ya expiró.
    const storedRefresh = localStorage.getItem('emerald_refresh');
    if (!storedRefresh && isTokenExpired(token)) {
      console.warn('[Auth] Access token expirado sin refresh token, forzando login');
      logout();
    }
  }, [token, user]);

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
        
        // Decodificar inmediatamente después del login
        const decodedUser = decodeToken(accessToken);
        if (decodedUser) {
          setUser(decodedUser);
        }
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
