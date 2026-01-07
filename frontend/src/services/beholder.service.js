/**
 * Beholder Service - Diagnóstico y búsqueda de clientes
 * Consume los endpoints de Beholder ya existentes en el backend
 */
import api from '@/api/client';

/**
 * Buscar clientes por nombre, DNI o PPPoE username
 * @param {string} query - Texto de búsqueda
 * @returns {Promise<Array>} Lista de clientes encontrados
 */
export const searchClients = async (query) => {
  try {
    const { data } = await api.get('/api/search', {
      params: { q: query },
    });
    return data;
  } catch (error) {
    console.error('❌ Error searching clients:', error);
    throw error;
  }
};

/**
 * Obtener diagnóstico completo de un cliente
 * @param {string} pppoeUser - Username PPPoE del cliente
 * @param {string} ip - IP opcional (si se quiere forzar un router específico)
 * @returns {Promise<Object>} Datos de diagnóstico completo
 */
export const getDiagnosis = async (pppoeUser, ip = null) => {
  try {
    const params = ip ? { ip } : {};
    const { data } = await api.get(`/api/diagnosis/${pppoeUser}`, { params });
    return data;
  } catch (error) {
    console.error(`❌ Error getting diagnosis for ${pppoeUser}:`, error);
    throw error;
  }
};

/**
 * Obtener tráfico en vivo de un cliente
 * @param {string} pppoeUser - Username PPPoE del cliente
 * @returns {Promise<Object>} Datos de tráfico en tiempo real
 */
export const getLiveTraffic = async (pppoeUser) => {
  try {
    const { data } = await api.get(`/live/${pppoeUser}`);
    return data;
  } catch (error) {
    console.error(`❌ Error getting live traffic for ${pppoeUser}:`, error);
    throw error;
  }
};

export default {
  searchClients,
  getDiagnosis,
  getLiveTraffic,
};
