/**
 * Logistics Service - Emerald ERP
 *
 * Centraliza la comunicación con el API de Logística:
 * - Entregas de materiales a cuadrillas
 * - Recepción de materiales devueltos
 * - Propuesta inteligente de materiales
 * - Escaneo de códigos de barra y seriales
 */
import api from '@/api/client';

const BASE_URL = '/v2/logistics';

// ============================================
// DELIVERIES
// ============================================

/**
 * Listar entregas de materiales.
 * @param {Object} filters - { team_id?, status?, date_from?, date_to? }
 * @returns {Promise<Array>}
 */
export const getDeliveries = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/deliveries`, { params: filters });
    return data;
  } catch (error) {
    console.error('❌ Error fetching deliveries:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una entrega.
 * @param {number} deliveryId
 * @returns {Promise<Object>}
 */
export const getDelivery = async (deliveryId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/deliveries/${deliveryId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Crear una nueva entrega en estado DRAFT.
 * @param {Object} payload - { team_id, warehouse_from_id, warehouse_to_id, notes? }
 * @returns {Promise<Object>}
 */
export const createDelivery = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating delivery:', error);
    throw error;
  }
};

/**
 * Generar/regenerar propuesta de materiales para una entrega.
 * @param {number} deliveryId
 * @param {Object} params - { date? }
 * @returns {Promise<Object>}
 */
export const generateProposal = async (deliveryId, params = {}) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/proposal`, params);
    return data;
  } catch (error) {
    console.error(`❌ Error generating proposal for delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Agregar un item manual a una entrega.
 * @param {number} deliveryId
 * @param {Object} payload - { product_id, quantity_delivered, notes? }
 * @returns {Promise<Object>}
 */
export const addDeliveryItem = async (deliveryId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/items`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error adding item to delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Eliminar un item de una entrega.
 * @param {number} deliveryId
 * @param {number} itemId
 */
export const removeDeliveryItem = async (deliveryId, itemId) => {
  try {
    await api.delete(`${BASE_URL}/deliveries/${deliveryId}/items/${itemId}`);
  } catch (error) {
    console.error(`❌ Error removing item ${itemId} from delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Escanear código de barra de un producto.
 * @param {number} deliveryId
 * @param {Object} payload - { product_code, quantity? }
 * @returns {Promise<Object>}
 */
export const scanBarcode = async (deliveryId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/scan-barcode`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error scanning barcode for delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Escanear serial de un producto serializado.
 * @param {number} deliveryId
 * @param {Object} payload - { product_id, serial_number }
 * @returns {Promise<Object>}
 */
export const scanSerial = async (deliveryId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/scan-serial`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error scanning serial for delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Confirmar una entrega y ejecutar la transferencia de stock.
 * @param {number} deliveryId
 * @returns {Promise<Object>}
 */
export const confirmDelivery = async (deliveryId) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/confirm`);
    return data;
  } catch (error) {
    console.error(`❌ Error confirming delivery ${deliveryId}:`, error);
    throw error;
  }
};

/**
 * Cancelar una entrega.
 * @param {number} deliveryId
 * @returns {Promise<Object>}
 */
export const cancelDelivery = async (deliveryId) => {
  try {
    const { data } = await api.post(`${BASE_URL}/deliveries/${deliveryId}/cancel`);
    return data;
  } catch (error) {
    console.error(`❌ Error cancelling delivery ${deliveryId}:`, error);
    throw error;
  }
};

// ============================================
// PROPOSAL PREVIEW
// ============================================

/**
 * Obtener vista previa de propuesta de materiales sin crear delivery.
 * @param {Object} params - { team_id, date_str?, dates? (array de 'YYYY-MM-DD') }
 * @returns {Promise<Object>}
 */
export const getProposalPreview = async (params) => {
  try {
    // Convertir array de fechas a string coma-separado si viene como array
    const normalized = { ...params };
    if (Array.isArray(normalized.dates)) {
      normalized.dates = normalized.dates.join(',');
    }
    const { data } = await api.get(`${BASE_URL}/proposal-preview`, { params: normalized });
    return data;
  } catch (error) {
    console.error('❌ Error fetching proposal preview:', error);
    throw error;
  }
};

/**
 * Obtener fechas con OTs programadas para una cuadrilla.
 * @param {number} teamId
 * @param {number} days - Horizonte en días (default 14)
 * @returns {Promise<{team_id: number, dates: Array<{date: string, work_orders_count: number}>}>}
 */
export const getTeamScheduleDates = async (teamId, days = 14) => {
  try {
    const { data } = await api.get(`${BASE_URL}/team-schedule-dates`, {
      params: { team_id: teamId, days },
    });
    return data;
  } catch (error) {
    console.error('❌ Error fetching team schedule dates:', error);
    throw error;
  }
};

// ============================================
// RECEIPTS
// ============================================

/**
 * Listar recepciones de materiales.
 * @param {Object} filters - { team_id?, date_from?, date_to? }
 * @returns {Promise<Array>}
 */
export const getReceipts = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/receipts`, { params: filters });
    return data;
  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    throw error;
  }
};

/**
 * Crear una nueva recepción.
 * @param {Object} payload - { team_id, warehouse_from_id, warehouse_to_id, notes? }
 * @returns {Promise<Object>}
 */
export const createReceipt = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/receipts`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating receipt:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una recepción.
 * @param {number} receiptId
 * @returns {Promise<Object>}
 */
export const getReceipt = async (receiptId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/receipts/${receiptId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching receipt ${receiptId}:`, error);
    throw error;
  }
};

/**
 * Escanear producto en recepción.
 * @param {number} receiptId
 * @param {Object} payload - { product_code, quantity? }
 * @returns {Promise<Object>}
 */
export const scanReceiptItem = async (receiptId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/receipts/${receiptId}/scan`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error scanning receipt item ${receiptId}:`, error);
    throw error;
  }
};

/**
 * Confirmar una recepción.
 * @param {number} receiptId
 * @returns {Promise<Object>}
 */
export const confirmReceipt = async (receiptId) => {
  try {
    const { data } = await api.post(`${BASE_URL}/receipts/${receiptId}/confirm`);
    return data;
  } catch (error) {
    console.error(`❌ Error confirming receipt ${receiptId}:`, error);
    throw error;
  }
};

/**
 * Obtener etiquetas SVG para unidades trazables generadas.
 * @param {number[]} serialItemIds
 * @returns {Promise<Array<{serial_item_id:number, serial_number:string, barcode_svg:string}>>}
 */
export const getTrackedUnitLabels = async (serialItemIds = []) => {
  try {
    const params = new URLSearchParams();
    serialItemIds
      .filter((id) => Number.isFinite(Number(id)))
      .forEach((id) => params.append('serial_item_ids', String(id)));

    const query = params.toString();
    const url = query
      ? `${BASE_URL}/tracked-units/labels?${query}`
      : `${BASE_URL}/tracked-units/labels`;

    const { data } = await api.get(url);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching tracked unit labels:', error);
    throw error;
  }
};


export default {
  // Deliveries
  getDeliveries,
  getDelivery,
  createDelivery,
  generateProposal,
  addDeliveryItem,
  removeDeliveryItem,
  scanBarcode,
  scanSerial,
  confirmDelivery,
  cancelDelivery,
  
  // Proposals
  getProposalPreview,
  getTeamScheduleDates,
  
  // Receipts
  getReceipts,
  getReceipt,
  createReceipt,
  scanReceiptItem,
  confirmReceipt,
  getTrackedUnitLabels,
};
