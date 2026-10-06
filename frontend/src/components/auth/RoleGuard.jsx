import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { hasPermission, can } from '@/utils/permissions';
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

  // Esperar hidratación de capabilities desde `/auth/me`. Mientras no estén
  // cargadas NO caer al fallback de matriz legacy: ésta no conoce roles nuevos
  // (p. ej. tecnico_encargado), los negaría y provocaría un loop de <Navigate>
  // (error del navegador "Throttling navigation..."). Una vez hidratadas,
  // `user.permissions` es un array (puede ser vacío si el backend falló).
  if (!Array.isArray(user.permissions)) {
    return <LoadingScreen />;
  }

  const viaCapabilities = can(user.permissions, resource, action);
  const permitted = viaCapabilities !== undefined
    ? viaCapabilities
    : hasPermission(user.role, resource, action);

  if (!permitted) {
    return <Navigate to={fallbackPath} replace state={{ deniedFrom: location.pathname }} />;
  }

  return children;
}
