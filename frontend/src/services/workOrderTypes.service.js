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
 * Crear un nuevo tipo de OT (solo admin).
 * @param {Object} payload - { code, name, description?, color?, icon? }
 * @returns {Promise<Object>}
 */
export const createWorkOrderType = async (payload) => {
  const { data } = await api.post('/v2/work-order-types', payload);
  return data;
};

/**
 * Eliminar un tipo de OT (solo admin).
 * @param {number} id
 */
export const deleteWorkOrderType = async (id) => {
  await api.delete(`/v2/work-order-types/${id}`);
};

/**
 * Actualizar un tipo de OT (nombre, color, icono).
 * @param {number} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const updateWorkOrderType = async (id, payload) => {
  const { data } = await api.put(`/v2/work-order-types/${id}`, payload);
  return data;
};

/**
 * Activar/desactivar un tipo de OT.
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const toggleWorkOrderType = async (id) => {
  const { data } = await api.patch(`/v2/work-order-types/${id}/toggle`);
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

// ============================================
// WO Actions (Resolution Actions)
// ============================================

/**
 * Listar acciones de resolución.
 * @param {Object} params - { ot_type?, active_only? }
 * @returns {Promise<Array>}
 */
export const getWOActions = async (params = {}) => {
  const { data } = await api.get('/v2/work-order-types/actions', { params });
  return data;
};

/**
 * Crear una acción de resolución.
 * @param {Object} payload - { ot_type, code, name, description?, requires_notes? }
 * @returns {Promise<Object>}
 */
export const createWOAction = async (payload) => {
  const { data } = await api.post('/v2/work-order-types/actions', payload);
  return data;
};

/**
 * Actualizar una acción de resolución.
 * @param {number} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const updateWOAction = async (id, payload) => {
  const { data } = await api.put(`/v2/work-order-types/actions/${id}`, payload);
  return data;
};

/**
 * Eliminar una acción de resolución.
 * @param {number} id
 */
export const deleteWOAction = async (id) => {
  await api.delete(`/v2/work-order-types/actions/${id}`);
};

export default {
  getWorkOrderTypes,
  buildTypeMap,
  createWorkOrderType,
  updateWorkOrderType,
  deleteWorkOrderType,
  toggleWorkOrderType,
  getWOTemplates,
  getWOTemplate,
  createWOTemplate,
  updateWOTemplate,
  deleteWOTemplate,
  getWOActions,
  createWOAction,
  updateWOAction,
  deleteWOAction,
};
