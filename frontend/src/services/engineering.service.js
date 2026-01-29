/**
 * Servicio de Engineering Tasks - Comunicación con API
 * 
 * Maneja CRUD de tareas técnicas del equipo NOC/Ingeniería
 */
import api from '@/api/client';

const BASE_URL = '/v2/engineering';

/**
 * Crear nueva tarea de ingeniería
 * @param {Object} payload - { ticket_id?, title, description, priority, task_type }
 * @returns {Promise<Object>} Tarea creada
 */
export const createTask = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/tasks`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating engineering task:', error);
    const message = error.response?.data?.detail || error.message || 'Error al crear tarea';
    throw new Error(message);
  }
};

/**
 * Obtener tareas asociadas a un ticket
 * @param {number} ticketId - ID del ticket
 * @returns {Promise<Array>} Lista de tareas
 */
export const getTasksByTicket = async (ticketId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/tasks`, {
      params: {
        ticket_id: ticketId,
        limit: 50,
      }
    });
    return data || [];
  } catch (error) {
    console.error(`❌ Error fetching tasks for ticket ${ticketId}:`, error);
    return [];
  }
};

/**
 * Obtener lista de tareas con filtros
 * @param {Object} filters - { status?, priority?, assigned_to_id?, task_type?, limit?, offset? }
 * @returns {Promise<Object>} { items: [], total: number }
 */
export const getTasks = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/tasks`, { params: filters });
    return data;
  } catch (error) {
    console.error('❌ Error fetching engineering tasks:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una tarea
 * @param {number} id - ID de la tarea
 * @returns {Promise<Object>} Tarea completa
 */
export const getTaskById = async (id) => {
  try {
    const { data } = await api.get(`${BASE_URL}/tasks/${id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching task ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener timeline de una tarea
 * @param {number} id - ID de la tarea
 * @returns {Promise<Array>} Eventos de timeline
 */
export const getTaskTimeline = async (id) => {
  try {
    const { data } = await api.get(`${BASE_URL}/tasks/${id}/timeline`);
    return data || [];
  } catch (error) {
    console.error(`❌ Error fetching task timeline ${id}:`, error);
    throw error;
  }
};

/**
 * Agregar nota al timeline de una tarea
 * @param {number} id - ID de la tarea
 * @param {string} content - Nota
 * @returns {Promise<Object>} Evento creado
 */
export const addTaskNote = async (id, content) => {
  try {
    const { data } = await api.post(`${BASE_URL}/tasks/${id}/timeline`, { content });
    return data;
  } catch (error) {
    console.error(`❌ Error adding task note ${id}:`, error);
    const message = error.response?.data?.detail || error.message || 'Error al agregar nota';
    throw new Error(message);
  }
};

/**
 * Actualizar tarea
 * @param {number} id - ID de la tarea
 * @param {Object} payload - { status?, priority?, assigned_to_id?, resolution_note? }
 * @returns {Promise<Object>} Tarea actualizada
 */
export const updateTask = async (id, payload) => {
  try {
    const { data } = await api.patch(`${BASE_URL}/tasks/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating task ${id}:`, error);
    const message = error.response?.data?.detail || error.message || 'Error al actualizar tarea';
    throw new Error(message);
  }
};

/**
 * Completar tarea (Atajo para ingenieros)
 * @param {number} id - ID de la tarea
 * @param {string} note - Nota de resolución
 * @returns {Promise<Object>} Tarea completada
 */
export const completeTask = async (id, note) => {
  try {
    const { data } = await api.post(`${BASE_URL}/tasks/${id}/complete?resolution_note=${encodeURIComponent(note)}`);
    return data;
  } catch (error) {
    console.error(`❌ Error completing task ${id}:`, error);
    const message = error.response?.data?.detail || error.message || 'Error al completar tarea';
    throw new Error(message);
  }
};

/**
 * Rechazar tarea
 * @param {number} id - ID de la tarea
 * @param {string} reason - Motivo del rechazo
 * @returns {Promise<Object>} Tarea rechazada
 */
export const rejectTask = async (id, reason) => {
  try {
    const { data } = await api.post(`${BASE_URL}/tasks/${id}/reject?rejection_reason=${encodeURIComponent(reason)}`);
    return data;
  } catch (error) {
    console.error(`❌ Error rejecting task ${id}:`, error);
    const message = error.response?.data?.detail || error.message || 'Error al rechazar tarea';
    throw new Error(message);
  }
};

/**
 * Obtener estadísticas del dashboard de ingeniería
 * @returns {Promise<Object>} Stats by status, priority, type
 */
export const getStats = async () => {
  try {
    const { data } = await api.get(`${BASE_URL}/stats/dashboard`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching engineering stats:', error);
    throw error;
  }
};

export default {
  createTask,
  getTasksByTicket,
  getTasks,
  getTaskById,
  getTaskTimeline,
  addTaskNote,
  updateTask,
  completeTask,
  rejectTask,
  getStats,
};

// Named export para compatibilidad con import { engineeringService }
export const engineeringService = {
  createTask,
  getTasksByTicket,
  getTasks,
  getTaskById,
  getTaskTimeline,
  addTaskNote,
  updateTask,
  completeTask,
  rejectTask,
  getStats,
};
