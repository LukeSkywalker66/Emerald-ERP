/**
 * usePersistedViewState — memoria de vista persistente por usuario y módulo.
 *
 * Guarda filtros/orden/paginación en el backend (cross-device) con caché
 * localStorage para primera pintura instantánea y lectura tolerante (claves
 * desconocidas se descartan, merge sobre defaults).
 *
 * Uso:
 *   const [view, setView, hydrated] = usePersistedViewState('tickets.grid', {
 *     status: '', priority: '', sortField: 'updated_at', sortDirection: 'desc',
 *   });
 *
 * @param {string} moduleKey - Clave del módulo (ej: 'tickets.grid').
 * @param {object} defaults - Valores por defecto (objeto estable, idealmente
 *                            declarado fuera del componente).
 * @returns {[object, Function, boolean]} [state, setState, hydrated]
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getPreference, savePreference } from '@/services/preferences.service';

const LS_PREFIX = 'emerald-view:';
const SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 600;

function cacheKey(userId, moduleKey) {
  return `${LS_PREFIX}${userId || 'anon'}:${moduleKey}`;
}

function readCache(userId, moduleKey) {
  try {
    const raw = localStorage.getItem(cacheKey(userId, moduleKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(userId, moduleKey, payload) {
  try {
    localStorage.setItem(cacheKey(userId, moduleKey), JSON.stringify(payload));
  } catch {
    // storage lleno / modo incógnito: no es crítico
  }
}

// Merge tolerante: parte de defaults y solo pisa claves conocidas.
function mergeWithDefaults(defaults, saved) {
  const out = { ...defaults };
  if (!saved || typeof saved !== 'object') return out;
  for (const key of Object.keys(defaults)) {
    if (saved[key] !== undefined && saved[key] !== null) {
      out[key] = saved[key];
    }
  }
  return out;
}

export default function usePersistedViewState(moduleKey, defaults = {}) {
  const { user } = useAuth();
  const userId = user?.id;

  // defaults estable (si el llamador lo redefine en cada render, usamos el primero)
  const defaultsRef = useRef(defaults);

  const [state, setState] = useState(defaults);
  const [hydrated, setHydrated] = useState(false);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Carga inicial: caché local (primera pintura) → backend (fuente de verdad).
  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;

    const cached = readCache(userId, moduleKey);
    if (cached) {
      setState((prev) => mergeWithDefaults(defaultsRef.current, cached));
    }

    getPreference(moduleKey)
      .then((res) => {
        const merged = mergeWithDefaults(defaultsRef.current, res?.payload);
        setState(merged);
        writeCache(userId, moduleKey, merged);
      })
      .catch(() => {
        // 404 u error: se mantiene la caché local o los defaults
      })
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, moduleKey]);

  // Guardado debounced tras cada cambio (solo después de hidratar).
  useEffect(() => {
    if (!userId || !hydrated) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = mergeWithDefaults(defaultsRef.current, state);
      writeCache(userId, moduleKey, payload);
      savePreference(moduleKey, payload, SCHEMA_VERSION).catch(() => {});
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated, userId, moduleKey]);

  return [state, setState, hydrated];
}
