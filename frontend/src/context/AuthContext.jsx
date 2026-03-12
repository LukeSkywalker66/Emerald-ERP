import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('emerald_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('emerald_refresh'));
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
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
      setAuthReady(true);
      return;
    }

    const decodedUser = decodeToken(token);
    if (!decodedUser) {
      // Token corrupto/inválido: cerrar sesión por seguridad.
      console.warn('[Auth] Token inválido/corrupto, forzando logout');
      logout();
      return;
    }

    if (!user || user.id !== decodedUser.id) {
      setUser(decodedUser);
    }

    // CRÍTICO: Solo cerrar sesión si el access token está REALMENTE expirado
    // Y no hay refresh token para obtener uno nuevo.
    // Esperar un tick para permitir que el refresh token se guarde en localStorage.
    const checkRefreshToken = () => {
      const storedRefresh = localStorage.getItem('emerald_refresh');
      
      if (!storedRefresh && isTokenExpired(token)) {
        console.warn('[Auth] Access token expirado sin refresh token, forzando login');
        logout();
        return;
      }

      if (isTokenExpired(token) && storedRefresh) {
        console.info('[Auth] Token expirado pero hay refresh_token disponible. refresh pending.');
      }
    };

    // Esperar un ciclo para que localStorage esté consistente
    const timer = setTimeout(checkRefreshToken, 0);
    setAuthReady(true);
    return () => clearTimeout(timer);
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
      
      if (!accessToken) {
        throw new Error('No access token in response');
      }

      // CRÍTICO: Guardar AMBOS tokens en localStorage ANTES de actualizar estado React
      // Esto evita race conditions en el useEffect
      localStorage.setItem('emerald_token', accessToken);
      localStorage.setItem('emerald_email', email);
      
      if (nextRefresh) {
        localStorage.setItem('emerald_refresh', nextRefresh);
      }

      // Ahora sí actualizar estado React (que dispara useEffect)
      setAuthReady(false);
      setToken(accessToken);
      if (nextRefresh) {
        setRefreshToken(nextRefresh);
      }
      
      // Decodificar inmediatamente después del login
      const decodedUser = decodeToken(accessToken);
      if (decodedUser) {
        setUser(decodedUser);
      }

      setAuthReady(true);

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
    setAuthReady(true);
  };

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      user,
      authReady,
      loading,
      error,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, refreshToken, user, authReady, loading, error]
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
