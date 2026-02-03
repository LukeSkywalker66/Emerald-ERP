/**
 * groupWorkOrders.js
 * 
 * Agrupa órdenes de trabajo por barrio (neighborhood).
 * Ordena dentro de cada grupo por antigüedad.
 */

import { compareAsc, parseISO } from 'date-fns';

/**
 * Extrae el barrio de una OT (desde el ticket asociado).
 * 
 * @param {Object} workOrder - Objeto WorkOrder con ticket anidado
 * @returns {string} Nombre del barrio o "Sin Zona"
 */
export const extractNeighborhood = (workOrder) => {
  if (!workOrder?.ticket) return 'Sin Zona';
  
  // Asumir que el backend retorna neighborhood en ticket
  // o extraerlo de address usando regex/parsing
  const neighborhood = workOrder.ticket.neighborhood || 
                     extractFromAddress(workOrder.ticket.address);
  
  return neighborhood || 'Sin Zona';
};

/**
 * Extrae barrio desde la dirección (fallback simple).
 * En producción, usar geocodificación real.
 * 
 * @param {string} address - Dirección completa
 * @returns {string|null} Barrio extraído o null
 */
function extractFromAddress(address) {
  if (!address) return null;
  
  // Tabla de barrios conocidos (simplificada para MVP)
  const neighborhoodMap = {
    'B° COLON': ['colon', 'colón'],
    'CENTRO': ['centro', 'downtown'],
    'NORTE': ['norte', 'north', 'avenida maipu'],
    'SUD': ['sud', 'south', 'sur'],
    'ESTE': ['este', 'east'],
    'OESTE': ['oeste', 'west'],
  };
  
  const addressLower = address.toLowerCase();
  
  for (const [neighborhood, keywords] of Object.entries(neighborhoodMap)) {
    if (keywords.some(kw => addressLower.includes(kw))) {
      return neighborhood;
    }
  }
  
  return null;
}

/**
 * Agrupa OTs por barrio.
 * 
 * @param {Array} workOrders - Lista de OTs
 * @param {Object} filters - { status, criticalOnly }
 * @returns {Object} { "B° COLON": [ot1, ot2], ... }
 */
export const groupWorkOrdersByNeighborhood = (workOrders = [], filters = {}) => {
  const { 
    status = ['pending_planning', 'coordinated'], 
    criticalOnly = false,
    city = null,
  } = filters;

  // 1. Filtrar por estado
  let filtered = workOrders.filter(wo => status.includes(wo.status));

  // 2. Filtrar por criticidad (prioridad)
  if (criticalOnly) {
    filtered = filtered.filter(wo => 
      wo.ticket?.priority === 'critical' || wo.ticket?.priority === 'high'
    );
  }

  // 3. Filtrar por ciudad (si se proporciona)
  if (city) {
    filtered = filtered.filter(wo => wo.ticket?.city === city);
  }

  // 4. Agrupar por barrio
  const grouped = filtered.reduce((acc, wo) => {
    const neighborhood = extractNeighborhood(wo);
    
    if (!acc[neighborhood]) {
      acc[neighborhood] = [];
    }
    
    acc[neighborhood].push(wo);
    return acc;
  }, {});

  // 5. Ordenar OTs dentro de cada grupo por antigüedad (más viejas primero)
  Object.keys(grouped).forEach(neighborhood => {
    grouped[neighborhood].sort((a, b) => {
      const dateA = parseISO(a.created_at);
      const dateB = parseISO(b.created_at);
      return compareAsc(dateA, dateB); // Ascendente: más viejas primero
    });
  });

  // 6. Ordenar grupos alfabéticamente (pero "Sin Zona" al final)
  const sortedGrouped = {};
  const keys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Sin Zona') return 1;
    if (b === 'Sin Zona') return -1;
    return a.localeCompare(b);
  });

  keys.forEach(key => {
    sortedGrouped[key] = grouped[key];
  });

  return sortedGrouped;
};

/**
 * Detecta si un grupo tiene tareas críticas.
 * 
 * @param {Array} workOrders - OTs del grupo
 * @returns {boolean}
 */
export const hasHighPriorityTasks = (workOrders = []) => {
  return workOrders.some(wo => 
    wo.ticket?.priority === 'critical' || wo.ticket?.priority === 'high'
  );
};

/**
 * Cuenta tareas por prioridad en un grupo.
 * 
 * @param {Array} workOrders - OTs del grupo
 * @returns {Object} { critical: 0, high: 0, medium: 0, low: 0 }
 */
export const countByPriority = (workOrders = []) => {
  return {
    critical: workOrders.filter(wo => wo.ticket?.priority === 'critical').length,
    high: workOrders.filter(wo => wo.ticket?.priority === 'high').length,
    medium: workOrders.filter(wo => wo.ticket?.priority === 'medium').length,
    low: workOrders.filter(wo => wo.ticket?.priority === 'low').length,
  };
};
