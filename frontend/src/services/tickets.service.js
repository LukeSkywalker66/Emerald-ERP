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
    const { data } = await api.get(`${BASE_URL}`, { params: filters });
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
    const { data } = await api.post(`${BASE_URL}`, payload);
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

/**
 * Actualizar ticket (PATCH parcial)
 * @param {number} id - ID del ticket
 * @param {Object} payload - { priority?, status?, assigned_to_id? }
 * @returns {Promise<Object>} Ticket actualizado
 */
export const updateTicket = async (id, payload) => {
  try {
    const { data } = await api.patch(`${BASE_URL}/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating ticket ${id}:`, error);
    throw error;
  }
};

/**
 * Agregar nota al timeline de un ticket
 * @param {number} ticketId - ID del ticket
 * @param {string} content - Contenido de la nota
 * @returns {Promise<Object>} Timeline event creado
 */
export const addNote = async (ticketId, content) => {
  try {
    const { data } = await api.post(`${BASE_URL}/${ticketId}/timeline`, {
      content,
      event_type: 'note',
    });
    return data;
  } catch (error) {
    console.error(`❌ Error adding note to ticket ${ticketId}:`, error);
    throw error;
  }
};

/**
 * Buscar conexiones/clientes
 * @param {string} query - Término de búsqueda
 * @returns {Promise<Array>} Array de conexiones encontradas
 */
export const searchConnections = async (query) => {
  try {
    const { data } = await api.get('/v2/search', { params: { q: query } });
    return data || [];
  } catch (error) {
    console.error('❌ Error searching connections:', error);
    throw error;
  }
};

/**
 * Obtener lista de usuarios activos
 * @returns {Promise<Array>} Array de usuarios
 */
export const getUsers = async () => {
  try {
    const { data } = await api.get('/v2/users');
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    throw error;
  }
};

export default {
  getAll,
  getById,
  create,
  createWorkOrder,
  updateTicket,
  addNote,
  searchConnections,
  getUsers,
};

