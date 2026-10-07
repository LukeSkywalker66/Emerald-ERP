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

/**
 * Reporta un error de frontend al backend (best-effort, fire-and-forget).
 * Nunca debe bloquear ni generar recursión: usa axios directo (no `api`).
 */
export function reportClientError({
  level = 'ERROR',
  module = null,
  message = 'Unknown error',
  stack = null,
  status = null,
  method = null,
  url = null,
  payload = null,
} = {}) {
  try {
    const token = localStorage.getItem('emerald_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios
      .post(
        `${baseURL}/v2/error-logs`,
        {
          level,
          source: 'frontend',
          module: module ? String(module).slice(0, 120) : null,
          message: String(message || 'Unknown error').slice(0, 4000),
          stack_trace: stack ? String(stack).slice(0, 20000) : null,
          status_code: status ?? null,
          request_method: method ? String(method).slice(0, 10) : null,
          request_path: url ? String(url).slice(0, 255) : null,
          context: payload ?? null,
        },
        { headers }
      )
      .catch(() => {});
  } catch {
    /* noop */
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
    
    // Reportar el error al backend (best-effort) para seguimiento remoto.
    // Se excluye 401 (ruido de sesión, ya manejado arriba).
    try {
      if (!response || response.status !== 401) {
        reportClientError({
          module: config?.url ? String(config.url).split('?')[0] : 'unknown',
          message: response?.data?.detail || response?.data?.message || message || 'Request failed',
          stack: error?.stack || null,
          status: response?.status ?? null,
          method: config?.method,
          url: config?.url,
          payload: response
            ? { statusText: response.statusText }
            : { network: true },
        });
      }
    } catch {
      /* noop */
    }
    
    return Promise.reject(error);
  }
);

export default api;
