/**
 * filterWorkOrders.js
 * 
 * Aplica filtros multicriterio a un array de tickets/OTs
 */

/**
 * @param {Array} workOrders - OTs sin filtrar
 * @param {Object} filters - { search, cities, types, onlyCritical }
 * @returns {Array} OTs filtradas
 */
export const applyTicketFilters = (workOrders = [], filters = {}) => {
  const {
    search = '',
    cities = [],
    types = [],
    onlyCritical = false,
  } = filters;

  return workOrders.filter((wo) => {
    const ticket = wo.ticket || {};

    // Filtro: Búsqueda universal
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const idMatch = wo.id?.toString().includes(searchLower);
      const clientMatch = ticket.client_name?.toLowerCase().includes(searchLower);
      const addressMatch = ticket.address?.toLowerCase().includes(searchLower);

      if (!idMatch && !clientMatch && !addressMatch) {
        return false;
      }
    }

    // Filtro: Localidades
    if (cities.length > 0) {
      const woCity = ticket.city || ticket.contact_info?.city || '';
      if (!cities.includes(woCity.trim())) {
        return false;
      }
    }

    // Filtro: Tipos de trabajo
    if (types.length > 0) {
      const woType = wo.ot_type || '';
      if (!types.includes(woType)) {
        return false;
      }
    }

    // Filtro: Solo críticos
    if (onlyCritical) {
      const priority = ticket.priority || 'low';
      if (!['critical', 'high'].includes(priority)) {
        return false;
      }
    }

    return true;
  });
};
