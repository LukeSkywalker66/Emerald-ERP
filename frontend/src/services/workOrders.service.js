/**
 * Servicio de Work Orders - Para técnicos
 */
import api from '@/api/client';

const BASE_URL = '/v2/work-orders';

/**
 * Crear una nueva OT
 * @param {Object} payload - { ticket_id, ot_type, priority?, description }
 * @returns {Promise<Object>} WorkOrder creada
 */
export const createWorkOrder = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating work order:', error);
    throw error;
  }
};

/**
 * Listar órdenes de trabajo con filtros opcionales
 * @param {Object} filters - { status?, date_range?, mobile_unit_id?, ot_type?, search?, limit?, offset? }
 * @returns {Promise<Object>} { items, total, limit, offset, pages }
 */
export const listWorkOrders = async (filters = {}) => {
  try {
    const params = {
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
      ...(filters.status && { status: filters.status }),
      ...(filters.date_range && { date_range: filters.date_range }),
      ...(filters.mobile_unit_id && { mobile_unit_id: filters.mobile_unit_id }),
      ...(filters.ot_type && { ot_type: filters.ot_type }),
      ...(filters.search && { search: filters.search }),
    };

    const { data } = await api.get(`${BASE_URL}`, { params });
    return data;
  } catch (error) {
    console.error('❌ Error fetching work orders:', error);
    throw error;
  }
};

/**
 * Obtener detalles completos de una OT
 * @param {number} workOrderId - ID de la OT
 * @returns {Promise<Object>} WorkOrder completo
 */
export const getWorkOrderDetail = async (workOrderId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/${workOrderId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching work order ${workOrderId}:`, error);
    throw error;
  }
};

/**
 * Actualizar estado/datos de OT
 * @param {number} workOrderId - ID de la OT
 * @param {Object} payload - { status?, started_at?, completed_at?, resolution_type?, custom_data? }
 * @returns {Promise<Object>} OT actualizada
 */
export const updateWorkOrder = async (workOrderId, payload) => {
  try {
    const { data } = await api.patch(`${BASE_URL}/${workOrderId}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating work order ${workOrderId}:`, error);
    throw error;
  }
};

/**
 * Agregar material consumido
 * @param {number} workOrderId - ID de la OT
 * @param {Object} payload - { product_id, quantity, serial_number?, notes? }
 * @returns {Promise<Object>} Item creado
 */
export const addWorkOrderItem = async (workOrderId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/${workOrderId}/items`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error adding item to work order ${workOrderId}:`, error);
    throw error;
  }
};

/**
 * Eliminar material
 * @param {number} workOrderId - ID de la OT
 * @param {number} itemId - ID del item
 */
export const removeWorkOrderItem = async (workOrderId, itemId) => {
  try {
    await api.delete(`${BASE_URL}/${workOrderId}/items/${itemId}`);
  } catch (error) {
    console.error(`❌ Error removing item ${itemId}:`, error);
    throw error;
  }
};

/**
 * Diagnóstico rápido (MOCK - integrar con Beholder después)
 * @param {number} connectionId - ID de conexión
 * @returns {Promise<Object>} Resultado del diagnóstico
 */
export const runQuickDiagnostic = async (connectionId) => {
  // TODO: Integrar con Beholder API
  // Por ahora, mock data
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockResult = {
        pppoe_status: Math.random() > 0.3 ? 'online' : 'offline',
        optical_signal_dbm: (-15 + Math.random() * 10).toFixed(2),
        uptime_hours: Math.floor(Math.random() * 48),
        last_check: new Date().toISOString(),
      };
      resolve(mockResult);
    }, 1500);
  });
};

export default {
  createWorkOrder,
  listWorkOrders,
  getWorkOrderDetail,
  updateWorkOrder,
  addWorkOrderItem,
  removeWorkOrderItem,
  runQuickDiagnostic,
};
