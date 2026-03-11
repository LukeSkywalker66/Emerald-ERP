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
    // Decodificar JWT para obtener user info
    const decodeToken = (accessToken) => {
      try {
        console.log('[Auth] Decodificando token...');
        const payload = accessToken.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        const exp = new Date(decoded.exp * 1000).toLocaleString();
        console.log(`[Auth] Token decodificado: sub=${decoded.sub}, email=${decoded.email}, exp=${exp}`);
        return {
          id: parseInt(decoded.sub, 10),
          email: decoded.email,
          username: decoded.username,
          is_superuser: decoded.is_superuser,
          role: decoded.role,
          full_name: localStorage.getItem('emerald_full_name') || decoded.email,
        };
      } catch (err) {
        console.error('[Auth] Error decodificando token:', err);
        return null;
      }
    };
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
          // CRÍTICO: Solo cerrar sesión si:
          // 1. El access token está REALMENTE expirado Y
          // 2. No hay refresh token disponible para obtener uno nuevo
          // Hacerlo SÍNCRONO (sin setTimeout) para evitar race conditions
          const storedRefresh = localStorage.getItem('emerald_refresh');
          const tokenExpired = isTokenExpired(token);
    
          if (tokenExpired && !storedRefresh) {
            console.warn('[Auth] Access token expirado SIN refresh token, forzando logout');
            logout();
            return;
          }

          if (tokenExpired && storedRefresh) {
      useEffect(() => {
        console.log('[Auth] useEffect [token, user] triggered. token present?', !!token);
    
        if (!token) {
          console.log('[Auth] No token present, clearing user');
          setUser(null);
          return;
        }

        const decodedUser = decodeToken(token);
        if (!decodedUser) {
          // Token corrupto/inválido: cerrar sesión por seguridad.
          console.warn('[Auth] Token inválido/corrupto, forzando logout');
          logout();
          return;
        }

        console.log('[Auth] Token válido. User:', decodedUser.email);
    
        if (!user || user.id !== decodedUser.id) {
          console.log('[Auth] Actualizando user state');
          setUser(decodedUser);
        }

        // CRÍTICO: Solo cerrar sesión si:
        // 1. El access token está REALMENTE expirado Y
        // 2. No hay refresh token disponible para obtener uno nuevo
        // Hacerlo SÍNCRONO (sin setTimeout) para evitar race conditions
        const storedRefresh = localStorage.getItem('emerald_refresh');
        const tokenExpired = isTokenExpired(token);
    
        console.log('[Auth] Expiry check: tokenExpired?', tokenExpired, 'hasRefresh?', !!storedRefresh);
    
        if (tokenExpired && !storedRefresh) {
          console.warn('[Auth] ⚠️ Access token EXPIRADO SIN refresh token, forzando logout');
          logout();
          return;
        }

        if (tokenExpired && storedRefresh) {
          console.info('[Auth] ℹ️ Token expirado pero hay refresh_token, mantener sesión para refresh automático');
        }
    
        console.log('[Auth] ✅ Token validation complete, sesión OK');
      }, [token, user]);
      if (decodedUser) {
        setUser(decodedUser);
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
