/**
 * Service for WorkOrderType configuration endpoints.
 *
 * Provides DB-driven labels, colors, and icons for work order types.
 * This replaces all hardcoded OT_TYPE dictionaries across the application.
 */
import api from '@/api/client';

/**
 * Fetch all work order type configurations.
 *
 * @param {boolean} activeOnly - If true, only return active types (default: true)
 * @returns {Promise<Array<{id: number, code: string, name: string, description: string|null, color: string, icon: string|null, is_active: boolean}>>}
 */
export const getWorkOrderTypes = async (activeOnly = true) => {
  const { data } = await api.get('/v2/work-order-types', {
    params: { active_only: activeOnly },
  });
  return data;
};

/**
 * Build a lookup map keyed by code for quick access.
 *
 * @param {Array} types - Array of work order type objects
 * @returns {Object} Map of code -> type object
 */
export const buildTypeMap = (types) => {
  const map = {};
  for (const t of types) {
    map[t.code] = t;
  }
  return map;
};

// ============================================
// WO Templates (Material Suggestions)
// ============================================


/**
 * Listar plantillas de materiales.
 * @param {Object} params - { active_only?, ot_type? }
 * @returns {Promise<Array>}
 */
export const getWOTemplates = async (params = {}) => {
  const { data } = await api.get('/v2/work-order-types/templates', { params });
  return data;
};

/**
 * Obtener una plantilla por ID.
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const getWOTemplate = async (id) => {
  const { data } = await api.get(`/v2/work-order-types/templates/${id}`);
  return data;
};

/**
 * Crear una nueva plantilla.
 * @param {Object} payload - { name, description?, ot_type?, is_active?, items[] }
 * @returns {Promise<Object>}
 */
export const createWOTemplate = async (payload) => {
  const { data } = await api.post('/v2/work-order-types/templates', payload);
  return data;
};

/**
 * Actualizar una plantilla.
 * @param {number} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const updateWOTemplate = async (id, payload) => {
  const { data } = await api.put(`/v2/work-order-types/templates/${id}`, payload);
  return data;
};

/**
 * Eliminar una plantilla.
 * @param {number} id
 */
export const deleteWOTemplate = async (id) => {
  await api.delete(`/v2/work-order-types/templates/${id}`);
};

export default {
  getWorkOrderTypes,
  buildTypeMap,
  getWOTemplates,
  getWOTemplate,
  createWOTemplate,
  updateWOTemplate,
  deleteWOTemplate,
};
