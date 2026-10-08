/**
 * Sales Service - Ventas al Público (acción de stock).
 */
import api from '@/api/client';

const BASE_URL = '/v2/sales';

/**
 * Listar ventas.
 * @param {Object} filters - { status?, limit?, offset? }
 */
export const listSales = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}`, { params: filters });
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching sales:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una venta.
 * @param {number} saleId
 */
export const getSale = async (saleId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/${saleId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching sale ${saleId}:`, error);
    throw error;
  }
};

/**
 * Crear una venta en borrador.
 * @param {Object} payload - { warehouse_id, reference?, notes?, items: [{product_id, quantity, serial_item_id?, notes?}] }
 */
export const createSale = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating sale:', error);
    throw error;
  }
};

/**
 * Confirmar una venta (descuenta stock).
 * @param {number} saleId
 */
export const confirmSale = async (saleId) => {
  try {
    const { data } = await api.post(`${BASE_URL}/${saleId}/confirm`);
    return data;
  } catch (error) {
    console.error(`❌ Error confirming sale ${saleId}:`, error);
    throw error;
  }
};

/**
 * Anular una venta en borrador.
 * @param {number} saleId
 */
export const cancelSale = async (saleId) => {
  try {
    const { data } = await api.post(`${BASE_URL}/${saleId}/cancel`);
    return data;
  } catch (error) {
    console.error(`❌ Error cancelling sale ${saleId}:`, error);
    throw error;
  }
};

export default {
  listSales,
  getSale,
  createSale,
  confirmSale,
  cancelSale,
};
