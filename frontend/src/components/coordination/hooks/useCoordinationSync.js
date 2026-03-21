/**
 * useCoordinationSync Hook
 * 
 * Gestiona sincronización automática con el backend.
 * Polling cada 5 segundos (pausa si página oculta).
 * BD es la fuente de verdad.
 * NOTA: Polling se desactiva automáticamente para fechas históricas (no es hoy).
 * 
 * @param {Date} currentDate - Fecha a sincronizar
 * @param {boolean} enabled - Habilitar polling
 * @param {Object} config - { pollInterval, autoStart, onError, onSync }
 * @returns {Object} { data, isLoading, error, refetch, start, stop }
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { format, startOfDay } from 'date-fns';
import api from '@/api/client';

export function useCoordinationSync(
  currentDate,
  enabled = true,
  config = {}
) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const pollingIntervalRef = useRef(null);
  const lastFetchRef = useRef(0);
  const abortControllerRef = useRef(null);
  const activeRequestIdRef = useRef(0);
  const hasInitializedDateRef = useRef(false);

  const {
    pollInterval = 5000,
    autoStart = true,
    onError = null,
    onSync = null,
  } = config;

  /**
   * Fetch data desde /coordination/grid
   */
  const fetchCoordinationData = useCallback(async (options = {}) => {
    const { force = false, reason = 'poll' } = options;

    // Deduplication: no hacer requests simultáneas
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 1000) {
      console.log('⏭️ Request duplicado evitado');
      return; // última fetch hace < 1 segundo
    }
    lastFetchRef.current = now;

    // Cancelar request anterior para evitar stale data
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const requestId = ++activeRequestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const dateParam = format(currentDate, 'yyyy-MM-dd');
      const accessToken = localStorage.getItem('emerald_token');

      if (!accessToken) {
        throw new Error('No hay token de sesión disponible');
      }

      // NO usar AbortController para cada request, solo crear una vez
      // Esto evita CanceledError innecesarios
      const response = await api.get('/v2/work-orders/coordination/grid', {
        params: {
          start_date: dateParam,
          end_date: dateParam,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: abortController.signal,
      });

      // Ignorar respuestas viejas que llegan fuera de orden
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      const newData = {
        teams: response.data?.teams || [],
        allocations: response.data?.allocations || [],
        backlog: response.data?.backlog || [],
        availableCities: extractCities(response.data?.backlog || []),
        syncedAt: Date.now(),
      };

      setData(newData);
      onSync?.(newData);
      console.log('✅ Datos sincronizados desde BD:', {
        teams: newData.teams.length,
        allocations: newData.allocations.length,
        backlog: newData.backlog.length,
        reason,
        syncedAt: new Date(newData.syncedAt).toLocaleTimeString(),
      });
    } catch (err) {
      // Ignorar AbortError (request cancelado intencionalmente)
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('❌ Error sincronizando:', err.message);
        if (requestId === activeRequestIdRef.current) {
          setError(err);
          onError?.(err);
        }
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentDate, onError, onSync]);

  /**
   * Iniciar polling automático
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Ya está corriendo

    // Fetch inmediatamente
    fetchCoordinationData({ reason: 'start' });

    // Luego cada pollInterval ms
    pollingIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        // Solo si página es visible
        fetchCoordinationData({ reason: 'poll' });
      }
    }, pollInterval);

    console.log(`📡 Polling iniciado (interval: ${pollInterval}ms)`);
  }, [fetchCoordinationData, pollInterval]);

  /**
   * Detener polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Polling detenido');
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Refetch manual
   */
  const refetch = useCallback((options = {}) => {
    if (options.force) {
      lastFetchRef.current = 0; // Reset deduplication
    }
    return fetchCoordinationData({ reason: 'manual', ...options });
  }, [fetchCoordinationData]);

  /**
   * Handle visibility change (pause/resume polling)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ Página oculta → pausando polling');
        stopPolling();
      } else {
        console.log('👁️ Página visible → reanudando polling');
        if (autoStart && enabled) {
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling, stopPolling, autoStart, enabled]);

  /**
   * Iniciar/detener polling cuando enabled o currentDate cambia
   * IMPORTANTE: No incluir startPolling/stopPolling en dependencias
   * para evitar feedback loops infinitos
   * NOTA: Solo hace polling si es fecha actual (hoy)
   */
  useEffect(() => {
    // Detectar si es hoy o una fecha pasada/futura
    const isToday = startOfDay(currentDate).getTime() === startOfDay(new Date()).getTime();

    if (enabled && autoStart && isToday) {
      startPolling();
      return () => stopPolling();
    } else {
      stopPolling();
    }
  }, [enabled, autoStart, currentDate, startPolling, stopPolling]);

  // Cambio de fecha: bypass de dedupe y fetch inmediato de contexto
  useEffect(() => {
    if (!enabled || !autoStart) return;

    // Evitar doble fetch en primer mount (startPolling ya hizo fetch)
    if (!hasInitializedDateRef.current) {
      hasInitializedDateRef.current = true;
      return;
    }

    refetch({ force: true, reason: 'date-change' });
  }, [currentDate, enabled, autoStart, refetch]);

  return {
    data,
    isLoading,
    error,
    refetch,
    start: startPolling,
    stop: stopPolling,
  };
}

/**
 * Extraer ciudades disponibles del backlog
 */
function extractCities(workOrders) {
  const cities = new Set();

  workOrders.forEach((wo) => {
    // Extraer de múltiples fuentes
    if (wo.address) {
      // address field directo
      const addressCity = parseAddressCity(wo.address);
      if (addressCity) cities.add(addressCity);
    }

    // Extraer de contact_info si existe
    if (wo.contact_info?.city) {
      cities.add(wo.contact_info.city);
    }

    // Extraer de connection_details si existe
    if (wo.connection_details?.city) {
      cities.add(wo.connection_details.city);
    }

    // Extraer de ticket si existe
    if (wo.ticket?.location) {
      cities.add(wo.ticket.location);
    }
  });

  return Array.from(cities).filter(Boolean).sort();
}

/**
 * Parsear ciudad de dirección (simple)
 * Ejemplo: "Calle A, San José, San José" → "San José"
 */
function parseAddressCity(address) {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim());
  // Última parte o penúltima (según formato)
  return parts[parts.length - 1] || null;
}
