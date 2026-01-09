import api from '@/api/client';

const rolesService = {
  /**
   * Obtener todos los roles disponibles
   */
  async getAllRoles() {
    const response = await api.get('/v2/roles/');
    return response.data;
  },
};

export default rolesService;
