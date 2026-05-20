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

export default {
  getWorkOrderTypes,
  buildTypeMap,
};
