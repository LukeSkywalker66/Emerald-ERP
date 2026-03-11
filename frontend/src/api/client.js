import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  maxRedirects: 5, // Axios sigue automáticamente los redirects 3xx
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('emerald_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

function clearSession() {
  localStorage.removeItem('emerald_token');
  localStorage.removeItem('emerald_refresh');
  localStorage.removeItem('emerald_email');
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function refreshToken() {
  const storedRefresh = localStorage.getItem('emerald_refresh');
  if (!storedRefresh) {
    console.warn('[Auth] No refresh token disponible');
    throw new Error('No hay refresh token disponible');
  }
  
  try {
    const { data } = await axios.post(
      `${baseURL}/v1/auth/refresh`,
      { refresh_token: storedRefresh },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const newAccess = data?.access_token;
    const newRefresh = data?.refresh_token;
    
    if (newAccess) {
      localStorage.setItem('emerald_token', newAccess);
      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
    }
    if (newRefresh) {
      localStorage.setItem('emerald_refresh', newRefresh);
    }
    return data;
  } catch (err) {
    console.error('[Auth] Refresh token failed:', err?.response?.status || err?.message);
    throw err;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config, code, message } = error || {};
    
    // Solo intentar refresh si el error es 401 y no es un retry
    if (response?.status === 401 && !config?._retry) {
      config._retry = true;
      
      try {
        // Verificar si tenemos un refresh token disponible
        const storedRefresh = localStorage.getItem('emerald_refresh');
        if (!storedRefresh) {
          console.warn('[Auth] 401 pero no hay refresh token, forzando logout');
          clearSession();
          redirectToLogin();
          return Promise.reject(error);
        }
        
        // Intentar refresh de token
        if (!refreshPromise) {
          refreshPromise = refreshToken().finally(() => {
            refreshPromise = null;
          });
        }
        
        const data = await refreshPromise;
        const newToken = data?.access_token;
        
        if (newToken) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${newToken}`,
          };
          console.info('[Auth] Token refreshed, retrying original request');
          return api(config);
        }
        
        // Si el refresh no devolvió un token válido
        clearSession();
        redirectToLogin();
        return Promise.reject(error);
        
      } catch (refreshError) {
        const refreshStatus = refreshError?.response?.status;
        
        // Solo hacer logout en casos definitivos (401, 403 del refresh)
        // No en errores de red transitorios
        if (refreshStatus === 401 || refreshStatus === 403) {
          console.error('[Auth] Refresh token inválido, forzando logout');
          clearSession();
          redirectToLogin();
        } else {
          // Error transitorio de red/servidor
          console.warn('[Auth] Refresh falló por error transitorio, manteniendo sesión local', refreshStatus || code);
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
