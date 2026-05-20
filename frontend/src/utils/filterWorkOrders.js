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

      // Fallback chain: top-level first, then ticket
      const clientName = wo.client_name || ticket.client_name || ticket.contact_info?.client_name || '';
      const address = wo.address || ticket.address || ticket.availability_note || '';

      const clientMatch = clientName.toLowerCase().includes(searchLower);
      const addressMatch = address.toLowerCase().includes(searchLower);
      // También buscar en ticket_title (subject) y description
      const titleMatch = (wo.ticket_title || ticket.subject || '').toLowerCase().includes(searchLower);

      if (!idMatch && !clientMatch && !addressMatch && !titleMatch) {
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
