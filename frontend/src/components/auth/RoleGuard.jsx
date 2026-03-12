import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/utils/permissions';
import LoadingScreen from '@/components/ui/LoadingScreen';

/**
 * Guard de acceso por recurso/accion.
 * Si no tiene permiso, redirige a una ruta segura.
 */
export default function RoleGuard({
  resource,
  action = 'view',
  fallbackPath = '/app/work-orders',
  children,
}) {
  const { user, token, authReady } = useAuth();
  const location = useLocation();

  // Evitar redirección prematura en recarga (F5) mientras AuthContext hidrata user desde token.
  if (!authReady || (token && !user)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!resource) {
    return children;
  }

  if (!hasPermission(user.role, resource, action)) {
    return <Navigate to={fallbackPath} replace state={{ deniedFrom: location.pathname }} />;
  }

  return children;
}
