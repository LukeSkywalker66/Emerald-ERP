/**
 * RBAC Motor - Matriz de Permisos por Rol
 * 
 * Arquitectura Nivel NASA para Control de Acceso Basado en Roles
 * ============================================================
 * 
 * Principios:
 * - Single Source of Truth: Esta matriz es la definición canónica de permisos
 * - Explicit is Better Than Implicit: Todos los permisos deben estar explícitos
 * - Fail-Safe: Por defecto, acceso DENEGADO. Se debe otorgar explícitamente
 * - Principle of Least Privilege: Cada rol tiene el mínimo necesario
 * 
 * Estructura:
 * {
 *   [resource]: {
 *     actions: ['view', 'create', 'edit', 'delete'],
 *     roleWhitelist: {
 *       [role]: true/false
 *     }
 *   }
 * }
 */

const PERMISSIONS_MATRIX = {
  // Dashboard
  'dashboard': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      // 'tecnico': false,  // ← NOTA: Desactivado por ahora. Será usado para gamificación
                             // (ranking de órdenes completadas, métricas personales, etc.)
                             // TODO(gamification-phase-2): Implementar dashboard táctico para técnicos
    },
  },

  // Tickets
  'tickets': {
    actions: ['view', 'create', 'edit', 'comment'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': true,
    },
    deniedActionsByRole: {
      tecnico: ['create', 'edit', 'comment', 'delete'],
    },
  },

  // Coordinación (Mapa + Asignación)
  'coordination': {
    actions: ['view', 'assign', 'unassign', 'view_teams'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      // 'tecnico': false,  // ← Técnicos NO ven coordinación
    },
  },

  // Órdenes de Trabajo (bifurcadas: técnico ve su ruta, admin ve todas)
  'work_orders': {
    actions: ['view', 'view_all', 'create', 'edit', 'complete'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': true,
    },
    deniedActionsByRole: {
      tecnico: ['view_all', 'create', 'edit'],
    },
  },

  // Ingeniería / Kanban
  'engineering': {
    actions: ['view', 'manage'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      // 'coordinator': true,  // Podría agregarse si se necesita
      // 'tecnico': false,
    },
  },

  // Cuadrillas (Gestión de equipos)
  'cuadrillas': {
    actions: ['view', 'create', 'edit', 'delete', 'assign_members'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      // 'tecnico': false,
    },
  },

  // Inventario (Logística)
  'inventory': {
    actions: ['view', 'view_all', 'edit', 'transfer', 'adjust'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'tecnico': true,
    },
    deniedActionsByRole: {
      tecnico: ['view_all', 'edit', 'transfer', 'adjust'],
    },
  },

  // Logística - Almacenes (lectura para técnico)
  'inventory_warehouses': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'tecnico': true,
    },
  },

  // Logística - Vistas administrativas (sin acceso para técnico)
  'inventory_admin': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      // 'tecnico': false,
    },
  },

  // Logística - Flota asignada (lectura para técnico)
  'fleet_assigned': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'tecnico': true,
    },
  },

  // Usuarios (Gestión de cuentas)
  'users': {
    actions: ['view', 'create', 'edit', 'delete', 'reset_password', 'change_role'],
    roleWhitelist: {
      'admin': true,
      'operator': false,
      // 'coordinator': false,
      // 'tecnico': false,
    },
  },

  // Configuración (Sistema)
  'settings': {
    actions: ['view', 'edit'],
    roleWhitelist: {
      'admin': true,
      'operator': false,
      // 'coordinator': false,
      // 'tecnico': false,
    },
  },

  // Auditoría (Solo Admin)
  'audit_logs': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      // 'operator': false,
      // 'coordinator': false,
      // 'tecnico': false,
    },
  },

  // Red y Clientes (Conexiones, Nodos, Clientes)
  // Por ahora sin restricción RBAC
  'connections': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': false, // TODO: definir si técnico puede ver conexiones
    },
  },

  'nodes': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': false, // TODO: definir si técnico puede ver nodos
    },
  },

  'clients': {
    actions: ['view'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': false, // TODO: definir si técnico puede ver clientes
    },
  },

  // Auto-gestión de perfil (cambiar contraseña, ver info propia)
  // Accesible para TODO usuario autenticado, independientemente de su rol
  'self_service': {
    actions: ['view', 'edit'],
    roleWhitelist: {
      'admin': true,
      'operator': true,
      'coordinator': true,
      'tecnico': true,
    },
  },
};

const ROLE_ALIAS = {
  technician: 'tecnico',
  tech: 'tecnico',
  super_user: 'admin',
  superuser: 'admin',
};

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return null;
  const lower = role.toLowerCase();
  return ROLE_ALIAS[lower] || lower;
};

/**
 * Obtiene todos los permisos de un usuario basado en su rol
 * @param {string} role - Rol del usuario ('admin', 'tecnico', etc.)
 * @returns {Object} Objeto con estructura { resource: { action: boolean } }
 */
export const getPermissionsForRole = (role) => {
  const normalizedRole = normalizeRole(role);
  const result = {};
  
  Object.entries(PERMISSIONS_MATRIX).forEach(([resource, config]) => {
    result[resource] = {};
    config.actions.forEach((action) => {
      result[resource][action] = hasPermission(normalizedRole, resource, action);
    });
  });
  
  return result;
};

/**
 * Verifica si un rol tiene permiso para una acción sobre un recurso
 * @param {string} role - Rol del usuario
 * @param {string} resource - Recurso ('dashboard', 'tickets', etc.)
 * @param {string} action - Acción ('view', 'create', 'edit', etc.)
 * @returns {boolean} true si tiene permiso
 */
export const hasPermission = (role, resource, action = 'view') => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  
  const resourceConfig = PERMISSIONS_MATRIX[resource];
  if (!resourceConfig) {
    console.warn(`❌ RBAC: Recurso desconocido "${resource}"`);
    return false; // Fail-safe: acceso denegado
  }
  
  if (!resourceConfig.actions.includes(action)) {
    console.warn(`❌ RBAC: Acción desconocida "${action}" en recurso "${resource}"`);
    return false;
  }

  const deniedByRole = resourceConfig.deniedActionsByRole?.[normalizedRole] || [];
  if (deniedByRole.includes(action)) {
    return false;
  }
  
  const hasAccess = resourceConfig.roleWhitelist[normalizedRole] === true;
  return hasAccess;
};

/**
 * Retorna todos los recursos que un rol TIENE PERMITIDO acceder
 * Útil para construir el menú dinámicamente
 * @param {string} role - Rol del usuario
 * @returns {string[]} Array de recursos permitidos
 */
export const getAccessibleResources = (role) => {
  const normalizedRole = normalizeRole(role);
  return Object.keys(PERMISSIONS_MATRIX).filter(
    (resource) => PERMISSIONS_MATRIX[resource].roleWhitelist[normalizedRole] === true
  );
};

/**
 * Validación de permisos para vistas
 * @param {string} role - Rol del usuario
 * @param {string} resource - Recurso a acceder
 * @throws {Error} Si el usuario NO tiene permiso
 */
export const requirePermission = (role, resource) => {
  if (!hasPermission(role, resource, 'view')) {
    throw new Error(`🔒 Acceso denegado a ${resource} para rol ${role}`);
  }
};

// Constantes predefinidas para usar en componentes
export const PERMISSIONS = {
  DASHBOARD_VIEW: { resource: 'dashboard', action: 'view' },
  TICKETS_VIEW: { resource: 'tickets', action: 'view' },
  TICKETS_CREATE: { resource: 'tickets', action: 'create' },
  TICKETS_EDIT: { resource: 'tickets', action: 'edit' },
  COORDINATION_VIEW: { resource: 'coordination', action: 'view' },
  COORDINATION_ASSIGN: { resource: 'coordination', action: 'assign' },
  WORK_ORDERS_VIEW: { resource: 'work_orders', action: 'view' },
  WORK_ORDERS_VIEW_ALL: { resource: 'work_orders', action: 'view_all' },
  WORK_ORDERS_COMPLETE: { resource: 'work_orders', action: 'complete' },
  ENGINEERING_VIEW: { resource: 'engineering', action: 'view' },
  ENGINEERING_MANAGE: { resource: 'engineering', action: 'manage' },
  CUADRILLAS_VIEW: { resource: 'cuadrillas', action: 'view' },
  CUADRILLAS_MANAGE: { resource: 'cuadrillas', action: 'edit' },
  INVENTORY_VIEW: { resource: 'inventory', action: 'view' },
  INVENTORY_VIEW_ALL: { resource: 'inventory', action: 'view_all' },
  INVENTORY_MANAGE: { resource: 'inventory', action: 'edit' },
  INVENTORY_WAREHOUSES_VIEW: { resource: 'inventory_warehouses', action: 'view' },
  INVENTORY_ADMIN_VIEW: { resource: 'inventory_admin', action: 'view' },
  FLEET_ASSIGNED_VIEW: { resource: 'fleet_assigned', action: 'view' },
  USERS_MANAGE: { resource: 'users', action: 'edit' },
  SETTINGS_VIEW: { resource: 'settings', action: 'view' },
  SETTINGS_EDIT: { resource: 'settings', action: 'edit' },
};
