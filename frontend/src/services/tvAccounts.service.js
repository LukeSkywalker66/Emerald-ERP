/**
 * Servicio de cuentas de TV (usuarios PPPoE de IPTV).
 */
import api from '@/api/client';

const BASE_URL = '/v2/tv-accounts';

/**
 * Listar cuentas de TV (opcional filtrar por status).
 * @param {string} status - 'available' | 'assigned'
 */
export const getTvAccounts = async (status) => {
  const { data } = await api.get(`${BASE_URL}`, {
    params: status ? { status } : {},
  });
  return data;
};

/**
 * Proponer la próxima cuenta de TV disponible (menor número libre).
 */
export const getNextAvailableTvAccount = async () => {
  const { data } = await api.get(`${BASE_URL}/next-available`);
  return data;
};

/**
 * Asignar una cuenta de TV a una conexión.
 */
export const assignTvAccount = async (accountId, connectionId) => {
  const { data } = await api.post(`${BASE_URL}/${accountId}/assign`, {
    connection_id: connectionId,
  });
  return data;
};

/**
 * Liberar una cuenta de TV (reutilizable).
 */
export const releaseTvAccount = async (accountId) => {
  const { data } = await api.post(`${BASE_URL}/${accountId}/release`);
  return data;
};

export default {
  getTvAccounts,
  getNextAvailableTvAccount,
  assignTvAccount,
  releaseTvAccount,
};
