/**
 * Can - Componente de Control de Acceso Basado en Permisos (RBAC)
 * 
 * Uso:
 * <Can action="view" resource="dashboard">
 *   <DashboardComponent />
 * </Can>
 * 
 * Si el usuario NO tiene permiso, retorna null (no renderiza nada)
 * Útil para ocultación segura de UI sin crear rutas alternativas
 */

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/utils/permissions';

/**
 * @param {Object} props
 * @param {string} props.resource - Recurso a verificar ('dashboard', 'tickets', etc.)
 * @param {string} [props.action='view'] - Acción a verificar ('view', 'create', 'edit', etc.)
 * @param {React.ReactNode} props.children - Contenido que se renderiza si tiene permiso
 * @param {React.ReactNode} [props.fallback] - Contenido alternativo si NO tiene permiso
 * @param {any} [props.data] - Data adicional a pasar (para lógica compleja)
 * @returns {React.ReactNode}
 */
export default function Can({ 
  resource, 
  action = 'view', 
  children, 
  fallback = null,
  data = null 
}) {
  const { user } = useAuth();

  if (!user || !resource) {
    console.warn('❌ Can: Usuario o recurso no definido', { user, resource });
    return fallback;
  }

  const userRole = user.role;
  const permitted = hasPermission(userRole, resource, action);

  if (!permitted) {
    // Debug en development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`🔒 Can: Acceso denegado a ${resource}.${action} para rol "${userRole}"`);
    }
    return fallback;
  }

  // Si es una función (renderProps pattern), llamarla con el user
  if (typeof children === 'function') {
    return children({ user, data });
  }

  // Si es un componente directo
  return children;
}

/**
 * Hook alternativo para lógica más compleja
 * 
 * Uso:
 * const can = useCan();
 * 
 * if (can('view', 'dashboard')) {
 *   // Renderizar dashboard
 * }
 */
export function useCan() {
  const { user } = useAuth();

  return (action = 'view', resource) => {
    if (!user || !resource) return false;
    return hasPermission(user.role, resource, action);
  };
}

/**
 * Componente auxiliar: Can.Box
 * Renderiza un contenedor condicional más fácilmente
 * 
 * Uso:
 * <Can.Box resource="coordination">
 *   <AdminPanel />
 * </Can.Box>
 */
Can.Box = function CanBox({ resource, action = 'view', children, className = '' }) {
  const { user } = useAuth();
  
  if (!user || !hasPermission(user.role, resource, action)) {
    return null;
  }

  return <div className={className}>{children}</div>;
};

/**
 * Componente auxiliar: Can.Show
 * Renderiza condicional con fallback más explícito
 * 
 * Uso:
 * <Can.Show 
 *   if={can('view', 'dashboard')}
 *   children={<Dashboard />}
 *   else={<Unauthorized />}
 * />
 */
Can.Show = function CanShow({ 
  resource, 
  action = 'view', 
  children, 
  else: fallback = null 
}) {
  const { user } = useAuth();
  
  if (!user || !hasPermission(user.role, resource, action)) {
    return fallback;
  }

  return children;
};
