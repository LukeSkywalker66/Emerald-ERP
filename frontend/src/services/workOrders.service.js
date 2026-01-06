/**
 * Servicio de Work Orders - Para técnicos
 */
import api from '@/api/client';

const BASE_URL = '/v2/work-orders';

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
  getWorkOrderDetail,
  updateWorkOrder,
  addWorkOrderItem,
  removeWorkOrderItem,
  runQuickDiagnostic,
};
