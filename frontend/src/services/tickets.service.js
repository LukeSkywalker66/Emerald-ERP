/**
 * Servicio centralizado de Tickets V2.0
 *
 * Centraliza toda la comunicación con la API de Tickets V2.
 * Maneja errores, transformación de datos y validación básica.
 */
import api from '@/api/client';

const BASE_URL = '/v2/tickets';

/**
 * Obtener lista de tickets con filtros opcionales
 * @param {Object} filters - { status?, priority?, limit?, offset? }
 * @returns {Promise<Array>} Array de tickets
 */
export const getAll = async (filters = {}) => {
  try {
    const { data } = await api.get(BASE_URL, { params: filters });
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching tickets:', error);
    throw error;
  }
};

/**
 * Obtener detalle completo de un ticket
 * @param {number} id - ID del ticket
 * @returns {Promise<Object>} Ticket con timeline y work_orders
 */
export const getById = async (id) => {
  try {
    const { data } = await api.get(`${BASE_URL}/${id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ticket ${id}:`, error);
    throw error;
  }
};

/**
 * Crear nuevo ticket
 * @param {Object} payload - { subject, description?, priority?, connection_id? }
 * @returns {Promise<Object>} Ticket creado
 */
export const create = async (payload) => {
  try {
    const { data } = await api.post(BASE_URL, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating ticket:', error);
    throw error;
  }
};

/**
 * Crear orden de trabajo (OT) para un ticket
 * @param {number} ticketId - ID del ticket
 * @param {Object} payload - { ot_type, notes? }
 * @returns {Promise<Object>} WorkOrder creada
 */
export const createWorkOrder = async (ticketId, payload) => {
  try {
    const { data } = await api.post(
      `${BASE_URL}/${ticketId}/work-orders`,
      payload
    );
    return data;
  } catch (error) {
    console.error(`❌ Error creating work order for ticket ${ticketId}:`, error);
    throw error;
  }
};

export default {
  getAll,
  getById,
  create,
  createWorkOrder,
};
