/**
 * Dashboard Service — API wrapper para métricas del tablero operativo.
 *
 * Endpoint: GET /api/v2/dashboard/summary
 */
import api from '@/api/client';

const BASE_URL = '/v2/dashboard';

/**
 * Obtener métricas agregadas del dashboard.
 *
 * @returns {Promise<Object>} Resumen con tickets, clientes, nodos, onus, work_orders, sync
 */
export const getDashboardSummary = async () => {
  const { data } = await api.get(`${BASE_URL}/summary`);
  return data;
};

export default {
  getDashboardSummary,
};
