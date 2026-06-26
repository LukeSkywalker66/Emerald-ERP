/**
 * Servicio de Configuración del Sistema (Settings)
 *
 * Centraliza la comunicación con la API de Settings (/api/v2/settings).
 * Maneja SystemConfig (key-value), ServiceMonitors y Sync tasks.
 */
import api from '@/api/client';

const BASE_URL = '/v2/settings';

// ─── SystemConfig (General Settings) ───────────────────────────────────

/**
 * Obtener todas las configuraciones generales
 * @returns {Promise<Array>} Array de configuraciones { id, key, value, description, ... }
 */
export const getAllSettings = async () => {
  try {
    const { data } = await api.get(BASE_URL);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    throw error;
  }
};

/**
 * Obtener una configuración por su key
 * @param {string} key - Nombre de la configuración
 * @returns {Promise<Object>} Configuración { id, key, value, description }
 */
export const getSettingByKey = async (key) => {
  try {
    const { data } = await api.get(`${BASE_URL}/${key}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching setting "${key}":`, error);
    throw error;
  }
};

/**
 * Actualizar una configuración individual
 * @param {string} key - Nombre de la configuración
 * @param {*} value - Valor a guardar
 * @param {string} [description] - Descripción opcional
 * @returns {Promise<Object>} Configuración actualizada
 */
export const updateSetting = async (key, value, description) => {
  try {
    const payload = { value };
    if (description !== undefined) payload.description = description;
    const { data } = await api.put(`${BASE_URL}/${key}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating setting "${key}":`, error);
    throw error;
  }
};

/**
 * Actualizar múltiples configuraciones en batch
 * @param {Object} settings - Dict key → value
 * @returns {Promise<Array>} Array de configuraciones actualizadas
 */
export const bulkUpdateSettings = async (settings) => {
  try {
    const { data } = await api.put(BASE_URL, { settings });
    return data || [];
  } catch (error) {
    console.error('❌ Error in bulk update settings:', error);
    throw error;
  }
};

/**
 * Eliminar una configuración
 * @param {string} key - Nombre de la configuración
 */
export const deleteSetting = async (key) => {
  try {
    await api.delete(`${BASE_URL}/${key}`);
  } catch (error) {
    console.error(`❌ Error deleting setting "${key}":`, error);
    throw error;
  }
};

// ─── Helper: convertir array de configs a mapa key→value ─────────────

/**
 * Convierte el array de configuraciones en un objeto plano key → value
 * @param {Array} settings - Array de { key, value, ... }
 * @returns {Object} Mapa de configuraciones
 */
export const settingsToMap = (settings) => {
  const map = {};
  (settings || []).forEach((s) => {
    map[s.key] = s.value;
  });
  return map;
};

/**
 * Convierte un mapa key→value y un array de configs completo
 * en el payload para bulk update (solo las keys que cambiaron)
 * @param {Object} dirtyValues - { key: newValue, ... }
 * @returns {Object} Payload para PUT /v2/settings
 */
export const buildBulkPayload = (dirtyValues) => ({
  settings: dirtyValues,
});

// ─── Service Monitors ─────────────────────────────────────────────────

/**
 * Obtener lista de monitores de servicio
 * @param {Object} params - { active_only?, criticality_min? }
 * @returns {Promise<Object>} { items, total, active_count, down_count }
 */
export const getMonitors = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/monitors`, { params });
    return data;
  } catch (error) {
    console.error('❌ Error fetching monitors:', error);
    throw error;
  }
};

/**
 * Obtener detalle de un monitor
 * @param {number} id - ID del monitor
 * @returns {Promise<Object>} Monitor detail
 */
export const getMonitor = async (id) => {
  try {
    const { data } = await api.get(`${BASE_URL}/monitors/${id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching monitor ${id}:`, error);
    throw error;
  }
};

/**
 * Crear un nuevo monitor
 * @param {Object} payload - MonitorCreate schema
 * @returns {Promise<Object>} Monitor creado
 */
export const createMonitor = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/monitors`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating monitor:', error);
    throw error;
  }
};

/**
 * Actualizar un monitor existente
 * @param {number} id - ID del monitor
 * @param {Object} payload - MonitorUpdate schema (campos opcionales)
 * @returns {Promise<Object>} Monitor actualizado
 */
export const updateMonitor = async (id, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/monitors/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating monitor ${id}:`, error);
    throw error;
  }
};

/**
 * Eliminar un monitor
 * @param {number} id - ID del monitor
 */
export const deleteMonitor = async (id) => {
  try {
    await api.delete(`${BASE_URL}/monitors/${id}`);
  } catch (error) {
    console.error(`❌ Error deleting monitor ${id}:`, error);
    throw error;
  }
};

/**
 * Ejecutar verificación manual de un monitor
 * @param {number} id - ID del monitor
 * @returns {Promise<Object>} Resultado del chequeo
 */
export const checkMonitor = async (id) => {
  try {
    const { data } = await api.post(`${BASE_URL}/monitors/${id}/check`);
    return data;
  } catch (error) {
    console.error(`❌ Error checking monitor ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener estadísticas resumidas de monitores
 * @returns {Promise<Object>} { total, active, down, critical_down, up, unknown }
 */
export const getMonitorStats = async () => {
  try {
    const { data } = await api.get(`${BASE_URL}/monitors/stats/summary`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching monitor stats:', error);
    throw error;
  }
};

// ─── Sync Tasks ────────────────────────────────────────────────────────

/**
 * Obtener historial de ejecuciones de sincronización
 * @param {Object} params - { task_name?, limit?, offset? }
 * @returns {Promise<Object>} { items, total }
 */
export const getSyncStatus = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/sync-status`, { params });
    return data;
  } catch (error) {
    console.error('❌ Error fetching sync status:', error);
    throw error;
  }
};

// ─── Scheduled Tasks V2 — Gestión persistente de tareas programadas ───────
// Reemplaza los antiguos endpoints /sync-tasks

/**
 * Listar tareas programadas con configuración persistente
 * @param {Object} params - { category?: string, include_system?: boolean }
 * @returns {Promise<Array>} Lista de ScheduledTask
 */
export const getScheduledTasks = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/scheduled-tasks`, { params });
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching scheduled tasks:', error);
    throw error;
  }
};

/**
 * Obtener detalle de una tarea programada por ID
 * @param {number} id - ID de la tarea
 * @returns {Promise<Object>} Datos de la tarea
 */
export const getScheduledTask = async (id) => {
  try {
    const { data } = await api.get(`${BASE_URL}/scheduled-tasks/${id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching scheduled task ${id}:`, error);
    throw error;
  }
};

/**
 * Actualizar configuración de una tarea programada
 * @param {number} id - ID de la tarea
 * @param {Object} payload - { cron_expression?, is_active?, max_executions? }
 * @returns {Promise<Object>} Tarea actualizada
 */
export const updateScheduledTask = async (id, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/scheduled-tasks/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating scheduled task ${id}:`, error);
    throw error;
  }
};

/**
 * Forzar ejecución inmediata de una tarea programada
 * @param {number} id - ID de la tarea
 * @returns {Promise<Object>} Resultado de la ejecución
 */
export const triggerScheduledTask = async (id) => {
  try {
    const { data } = await api.post(`${BASE_URL}/scheduled-tasks/${id}/trigger`);
    return data;
  } catch (error) {
    console.error(`❌ Error triggering scheduled task ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener historial de ejecuciones de una tarea
 * @param {number} id - ID de la tarea
 * @param {Object} params - { limit?, offset? }
 * @returns {Promise<Object>} { items, total, limit, offset }
 */
export const getScheduledTaskLogs = async (id, params = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/scheduled-tasks/${id}/logs`, { params });
    return data;
  } catch (error) {
    console.error(`❌ Error fetching logs for task ${id}:`, error);
    throw error;
  }
};

/**
 * Sincronizar tareas desde Celery Beat schedule
 * @returns {Promise<Object>} { success, tasks_synced, message }
 */
export const syncScheduledTasks = async () => {
  try {
    const { data } = await api.post(`${BASE_URL}/scheduled-tasks/sync`);
    return data;
  } catch (error) {
    console.error('❌ Error syncing scheduled tasks:', error);
    throw error;
  }
};

// ─── Backup ─────────────────────────────────────────────────────────────

export const getBackupConfig = async () => {
  const { data } = await api.get('/v2/settings/backup/config');
  return data;
};

export const updateBackupConfig = async (payload) => {
  const { data } = await api.put('/v2/settings/backup/config', payload);
  return data;
};

export const listBackupRuns = async (limit = 20) => {
  const { data } = await api.get('/v2/settings/backup/runs', { params: { limit } });
  return data;
};

export const triggerBackupNow = async () => {
  const { data } = await api.post('/v2/settings/backup/run-now');
  return data;
};

export default {
  getSettingByKey,
  updateSetting,
  bulkUpdateSettings,
  deleteSetting,
  settingsToMap,
  buildBulkPayload,
  getMonitors,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  checkMonitor,
  getMonitorStats,
  getSyncStatus,
  getScheduledTasks,
  getScheduledTask,
  updateScheduledTask,
  triggerScheduledTask,
  getScheduledTaskLogs,
  syncScheduledTasks,
  getBackupConfig,
  updateBackupConfig,
  listBackupRuns,
  triggerBackupNow,
};
