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

async function refreshToken() {
  const storedRefresh = localStorage.getItem('emerald_refresh');
  if (!storedRefresh) {
    throw new Error('No hay refresh token disponible');
  }
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
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error || {};
    if (response?.status === 401 && !config?._retry) {
      config._retry = true;
      try {
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
        }
        return api(config);
      } catch (refreshError) {
        localStorage.removeItem('emerald_token');
        localStorage.removeItem('emerald_refresh');
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
