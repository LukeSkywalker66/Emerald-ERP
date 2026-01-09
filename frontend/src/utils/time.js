/**
 * Utilidades para formatear tiempos relativos
 */

/**
 * Formatea un timestamp a tiempo relativo (ej: "hace 5 minutos")
 */
export function formatTimeAgo(dateString) {
  if (!dateString) return 'Nunca';

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Ahora mismo';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  }
  if (seconds < 2592000) {
    const days = Math.floor(seconds / 86400);
    return `hace ${days} día${days > 1 ? 's' : ''}`;
  }

  return date.toLocaleDateString('es-AR');
}

/**
 * Determina si un usuario está online (último login en los últimos 30 minutos)
 */
export function isUserOnline(lastLogin, minutesThreshold = 30) {
  if (!lastLogin) return false;

  const date = new Date(lastLogin);
  const now = new Date();
  const minutes = Math.floor((now - date) / 60000);

  return minutes <= minutesThreshold;
}
