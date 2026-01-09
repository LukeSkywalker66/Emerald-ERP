import api from '@/api/client';

const usersService = {
  /**
   * Obtener todos los usuarios (solo superusuarios)
   */
  async getAllUsers() {
    const response = await api.get('/v2/users/');
    return response.data;
  },

  /**
   * Crear un nuevo usuario
   */
  async createUser(userData) {
    const response = await api.post('/v2/users/', userData);
    return response.data;
  },

  /**
   * Resetear contraseña de un usuario (genera temporal)
   * @param {number} userId - ID del usuario
   * @param {string} [customPassword] - Contraseña personalizada opcional
   */
  async resetPassword(userId, customPassword = null) {
    const payload = customPassword ? { new_password: customPassword } : null;
    const response = await api.post(`/v2/users/${userId}/reset-password`, payload);
    return response.data;
  },

  /**
   * Cambiar rol de un usuario
   */
  async changeRole(userId, roleId) {
    const response = await api.patch(`/v2/users/${userId}/role`, {
      role_id: roleId,
    });
    return response.data;
  },

  /**
   * Activar o desactivar un usuario
   */
  async updateStatus(userId, isActive) {
    const response = await api.patch(`/v2/users/${userId}/status`, {
      is_active: isActive,
    });
    return response.data;
  },
};

export default usersService;
