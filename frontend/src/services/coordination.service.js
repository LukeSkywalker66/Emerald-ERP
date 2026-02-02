/**
 * coordination.service.js
 * 
 * Servicio para gestión de coordinación (cuadrillas/teams).
 */

import api from '@/api/client';

const BASE_URL = '/v2/coordination';

/**
 * Obtener todas las cuadrillas
 * @param {Object} params - { active_only?: boolean }
 * @returns {Promise<Array>}
 */
export const getTeams = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/teams`, { params });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una cuadrilla
 * @param {number} teamId
 * @returns {Promise<Object>}
 */
export const getTeamDetail = async (teamId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/teams/${teamId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching team ${teamId}:`, error);
    throw error;
  }
};

/**
 * Crear nueva cuadrilla
 * @param {Object} payload - { name, vehicle_id?, is_active? }
 * @returns {Promise<Object>}
 */
export const createTeam = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/teams`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating team:', error);
    throw error;
  }
};

/**
 * Actualizar cuadrilla
 * @param {number} teamId
 * @param {Object} payload - { name?, vehicle_id?, is_active? }
 * @returns {Promise<Object>}
 */
export const updateTeam = async (teamId, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/teams/${teamId}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating team ${teamId}:`, error);
    throw error;
  }
};

/**
 * Eliminar cuadrilla (soft delete)
 * @param {number} teamId
 * @returns {Promise<void>}
 */
export const deleteTeam = async (teamId) => {
  try {
    await api.delete(`${BASE_URL}/teams/${teamId}`);
  } catch (error) {
    console.error(`❌ Error deleting team ${teamId}:`, error);
    throw error;
  }
};

/**
 * Agregar miembro a cuadrilla
 * @param {number} teamId
 * @param {Object} payload - { user_id, role }
 * @returns {Promise<Object>}
 */
export const addTeamMember = async (teamId, payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/teams/${teamId}/members`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error adding team member:`, error);
    throw error;
  }
};

/**
 * Eliminar miembro de cuadrilla
 * @param {number} teamId
 * @param {number} userId
 * @returns {Promise<void>}
 */
export const removeTeamMember = async (teamId, userId) => {
  try {
    await api.delete(`${BASE_URL}/teams/${teamId}/members/${userId}`);
  } catch (error) {
    console.error(`❌ Error removing team member:`, error);
    throw error;
  }
};

/**
 * Actualizar rol de miembro
 * @param {number} teamId
 * @param {number} userId
 * @param {string} role - "leader" | "technician"
 * @returns {Promise<Object>}
 */
export const updateMemberRole = async (teamId, userId, role) => {
  try {
    const { data } = await api.put(
      `${BASE_URL}/teams/${teamId}/members/${userId}/role`,
      {},
      { params: { role } }
    );
    return data;
  } catch (error) {
    console.error(`❌ Error updating member role:`, error);
    throw error;
  }
};

/**
 * Obtener cuadrillas de un usuario
 * @param {number} userId
 * @returns {Promise<Array>}
 */
export const getUserTeams = async (userId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/users/${userId}/teams`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`❌ Error fetching user teams:`, error);
    throw error;
  }
};

export default {
  getTeams,
  getTeamDetail,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  getUserTeams,
};
