/**
 * fleet.service.js
 * 
 * Servicio para gestión de flota (vehículos).
 */

import api from '@/api/client';

const BASE_URL = '/v2/vehicles';
const INSPECTIONS_BASE_URL = '/v2/fleet';

/**
 * Obtener todos los vehículos
 * @param {Object} params - { status?: string }
 * @returns {Promise<Array>}
 */
export const getVehicles = async (params = {}) => {
  try {
    const { data } = await api.get(BASE_URL, { params });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Error fetching vehicles:', error);
    throw error;
  }
};

/**
 * Obtener detalle de un vehículo
 * @param {number} vehicleId
 * @returns {Promise<Object>}
 */
export const getVehicleDetail = async (vehicleId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/${vehicleId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Crear nuevo vehículo
 * @param {Object} payload - { name, license_plate?, vehicle_brand?, vehicle_model?, vehicle_year?, status? }
 * @returns {Promise<Object>}
 */
export const createVehicle = async (payload) => {
  try {
    const { data } = await api.post(BASE_URL, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating vehicle:', error);
    throw error;
  }
};

/**
 * Actualizar vehículo
 * @param {number} vehicleId
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const updateVehicle = async (vehicleId, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/${vehicleId}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Eliminar vehículo (soft-delete)
 * @param {number} vehicleId
 * @returns {Promise<void>}
 */
export const deleteVehicle = async (vehicleId) => {
  try {
    await api.delete(`${BASE_URL}/${vehicleId}`);
  } catch (error) {
    console.error(`❌ Error deleting vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Verificar inspección diaria del vehículo.
 * @param {number} vehicleId
 * @returns {Promise<Object>} inspección de hoy
 */
export const checkTodayInspection = async (vehicleId) => {
  try {
    const { data } = await api.get(`${INSPECTIONS_BASE_URL}/vehicles/${vehicleId}/inspections/today`);
    return data;
  } catch (error) {
    console.error(`❌ Error checking today inspection for vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Enviar planilla de inspección diaria.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const submitInspection = async (payload) => {
  try {
    const { data } = await api.post(`${INSPECTIONS_BASE_URL}/inspections`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error submitting vehicle inspection:', error);
    throw error;
  }
};

/**
 * Obtener historial de inspecciones.
 * @param {Object} params - { vehicle_id?: number, inspection_date?: string }
 * @returns {Promise<Array>}
 */
export const getInspectionsHistory = async (params = {}) => {
  try {
    const { data } = await api.get(`${INSPECTIONS_BASE_URL}/inspections`, { params });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Error fetching inspections history:', error);
    throw error;
  }
};

// Export como objeto para mantener compatibilidad con otros servicios
export default {
  getVehicles,
  getVehicleDetail,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  checkTodayInspection,
  submitInspection,
  getInspectionsHistory,
};
