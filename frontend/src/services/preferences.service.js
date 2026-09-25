/**
 * Servicio de preferencias de usuario (memoria de vistas).
 *
 * GET/PUT /api/v2/me/preferences/{moduleKey} — payload JSONB versionado.
 */
import api from '@/api/client';

const BASE_URL = '/v2/me/preferences';

/**
 * Obtiene la preferencia guardada de un módulo.
 * @param {string} moduleKey - Clave del módulo (ej: 'tickets.grid')
 * @returns {Promise<{module_key:string,payload:object,schema_version:number,updated_at:string}>}
 * @throws 404 si no hay preferencia guardada.
 */
export const getPreference = async (moduleKey) => {
  const { data } = await api.get(`${BASE_URL}/${encodeURIComponent(moduleKey)}`);
  return data;
};

/**
 * Guarda (upsert) la preferencia de un módulo.
 * @param {string} moduleKey - Clave del módulo.
 * @param {object} payload - Configuración de vista (JSON libre).
 * @param {number} schemaVersion - Versión del esquema del payload.
 */
export const savePreference = async (moduleKey, payload, schemaVersion = 1) => {
  const { data } = await api.put(`${BASE_URL}/${encodeURIComponent(moduleKey)}`, {
    payload,
    schema_version: schemaVersion,
  });
  return data;
};
