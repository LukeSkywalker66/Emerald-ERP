/**
 * Servicio de Inventario Operativo - Emerald ERP
 *
 * Centraliza toda la comunicación con el API de Inventario.
 * Maneja errores, transformación de datos y validación básica.
 *
 * Endpoints disponibles:
 * - Warehouses: GET/POST /api/v2/inventory/warehouses, GET /{id}/stock
 * - Products: GET/POST /api/v2/inventory/products
 * - Serial Items: POST /api/v2/inventory/serial-items
 * - Operations: POST /api/v2/inventory/transfer, POST /api/v2/inventory/adjustments
 * - Movements: GET /api/v2/inventory/movements
 * - **Stock Alerts (Optimizado):** GET /api/v2/inventory/stock/alerts
 */
import api from '@/api/client';

const BASE_URL = '/v2/inventory';

// ============================================
// PROMISE CACHING (elimina N+1 HTTP duplicados)
// ============================================
// Cachea la Promise (no el resultado) para que múltiples llamadas síncronas
// en el mismo tick compartan la misma request HTTP.
let _warehousesPromiseCache = null;
let _productsPromiseCache = null;

function _invalidateCaches() {
  _warehousesPromiseCache = null;
  _productsPromiseCache = null;
}

// ============================================
// WAREHOUSES
// ============================================

/**
 * Obtener lista de warehouses con filtros opcionales
 * @param {Object} filters - { warehouse_type?, user_id? }
 * @returns {Promise<Array>} Array de warehouses
 */
export const getWarehouses = async (filters = {}) => {
  const noFilters = Object.keys(filters).length === 0;
  // Usar cache solo cuando no hay filtros (caso común para stats/alerts)
  if (noFilters && _warehousesPromiseCache) {
    return _warehousesPromiseCache;
  }
  try {
    const promise = api.get(`${BASE_URL}/warehouses`, { params: filters })
      .then(res => res.data || []);
    if (noFilters) _warehousesPromiseCache = promise;
    return promise;
  } catch (error) {
    console.error('❌ Error fetching warehouses:', error);
    throw error;
  }
};

/**
 * Obtener el warehouse MOBILE asignado a un técnico específico.
 * Usa el filtro user_id del backend en lugar de filtrar client-side.
 * @param {number} userId - ID del usuario técnico logueado
 * @returns {Promise<Object|null>} Warehouse o null si no existe
 */
export const getMyWarehouse = async (userId) => {
  if (!userId) return null;

  try {
    const { data } = await api.get(`${BASE_URL}/warehouses`, {
      params: { warehouse_type: 'MOBILE', user_id: userId }
    });
    return data?.[0] || null;
  } catch (error) {
    console.error('❌ Error fetching technician warehouse:', error);
    throw error;
  }
};

/**
 * Crear nuevo warehouse
 * @param {Object} payload - { name, type, user_id? }
 * @returns {Promise<Object>} Warehouse creado
 */
export const createWarehouse = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/warehouses`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating warehouse:', error);
    throw error;
  }
};

/**
 * Actualizar warehouse existente
 * @param {number} warehouseId - ID del warehouse
 * @param {Object} payload - { name?, type?, user_id? }
 * @returns {Promise<Object>} Warehouse actualizado
 */
export const updateWarehouse = async (warehouseId, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/warehouses/${warehouseId}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating warehouse ${warehouseId}:`, error);
    throw error;
  }
};

/**
 * Eliminar warehouse
 * @param {number} warehouseId - ID del warehouse
 * @returns {Promise<void>}
 * @throws {Error} Si tiene stock o movimientos asociados (409 Conflict)
 */
export const deleteWarehouse = async (warehouseId) => {
  try {
    await api.delete(`${BASE_URL}/warehouses/${warehouseId}`);
  } catch (error) {
    console.error(`❌ Error deleting warehouse ${warehouseId}:`, error);
    throw error;
  }
};

/**
 * Obtener stock completo de un warehouse (BULK + SERIALIZED)
 * @param {number} warehouseId - ID del warehouse
 * @returns {Promise<Object>} Stock unificado con serial_items
 */
export const getWarehouseStock = async (warehouseId) => {
  try {
    const { data } = await api.get(`${BASE_URL}/warehouses/${warehouseId}/stock`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching stock for warehouse ${warehouseId}:`, error);
    throw error;
  }
};

// ============================================
// PRODUCTS
// ============================================

/**
 * Obtener catálogo de productos con filtros
 * @param {Object} filters - { product_type?, category?, search? }
 * @returns {Promise<Array>} Array de productos
 */
/**
 * Obtener catálogo de productos con filtros server-side (NASA-level optimization)
 * @param {Object} filters - { type: 'BULK'|'SERIALIZED', category: string, search: string }
 * @returns {Promise<Array>} Array de productos
 */
export const getProducts = async (filters = {}) => {
  const noFilters = Object.keys(filters).length === 0;
  // Usar cache solo cuando no hay filtros (caso común para stats/alerts)
  if (noFilters && _productsPromiseCache) {
    return _productsPromiseCache;
  }
  try {
    const promise = api.get(`${BASE_URL}/products`, { params: filters })
      .then(res => res.data || []);
    if (noFilters) _productsPromiseCache = promise;
    return promise;
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    console.error('  Filters sent:', filters);
    console.error('  URL:', `${BASE_URL}/products`);
    throw error;
  }
};

/**
 * Crear nuevo producto
 * @param {Object} payload - { name, sku, type, category?, description?, min_stock_alert? }
 * @returns {Promise<Object>} Producto creado
 */
export const createProduct = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/products`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating product:', error);
    throw error;
  }
};

/**
 * Actualizar producto existente
 * @param {number} productId - ID del producto
 * @param {Object} payload - { name?, sku?, category?, description?, min_stock_alert? }
 * @returns {Promise<Object>} Producto actualizado
 * @note El campo "type" es inmutable y se ignora si viene en el request
 */
export const updateProduct = async (productId, payload) => {
  try {
    const { data } = await api.put(`${BASE_URL}/products/${productId}`, payload);
    return data;
  } catch (error) {
    console.error(`❌ Error updating product ${productId}:`, error);
    throw error;
  }
};

/**
 * Eliminar producto del catálogo
 * @param {number} productId - ID del producto
 * @returns {Promise<void>}
 * @throws {Error} Si tiene stock o movimientos asociados (409 Conflict)
 */
export const deleteProduct = async (productId) => {
  try {
    await api.delete(`${BASE_URL}/products/${productId}`);
  } catch (error) {
    console.error(`❌ Error deleting product ${productId}:`, error);
    throw error;
  }
};

// ============================================
// SERIAL ITEMS
// ============================================

/**
 * Registrar nuevo item serializado
 * @param {Object} payload - { serial_number, product_id, warehouse_id, status, notes? }
 * @returns {Promise<Object>} Serial item creado
 */
export const createSerialItem = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/serial-items`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error creating serial item:', error);
    throw error;
  }
};

// ============================================
// STOCK OPERATIONS
// ============================================

/**
 * Transferir stock entre warehouses
 * @param {Object} payload - { product_id, from_warehouse_id, to_warehouse_id, quantity?, serial_item_ids?, reference?, notes? }
 * @returns {Promise<Object>} { success, movements_created, message }
 */
export const transferStock = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/transfer`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error transferring stock:', error);
    // Re-throw para que el componente pueda manejar el error
    throw error;
  }
};

/**
 * Ajustar stock (compras, correcciones, ingresos iniciales)
 * @param {Object} payload - { product_id, warehouse_id, quantity, movement_type, reference?, notes? }
 * @returns {Promise<Object>} { success, movement_id, stock_bulk_id, previous_quantity, new_quantity, message }
 */
export const adjustStock = async (payload) => {
  try {
    const { data } = await api.post(`${BASE_URL}/adjustments`, payload);
    return data;
  } catch (error) {
    console.error('❌ Error adjusting stock:', error);
    throw error;
  }
};

// ============================================
// MOVEMENTS (AUDITORÍA)
// ============================================

/**
 * Obtener historial de movimientos con filtros
 * @param {Object} filters - { product_id?, warehouse_id?, movement_type?, limit?, offset? }
 * @returns {Promise<Array>} Array de movimientos ordenados por fecha DESC
 */
export const getMovements = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/movements`, { params: filters });
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching movements:', error);
    throw error;
  }
};

// ============================================
// STOCK ALERTS (OPTIMIZADO — Una sola request)
// ============================================

/**
 * Obtener alertas de stock bajo usando el endpoint optimizado.
 *
 * **ANTES (N+1 masivo):** N productos × M warehouses = N×M requests HTTP
 * **AHORA:** Una sola query agregada en el backend (LEFT JOIN + GROUP BY + HAVING)
 *
 * @returns {Promise<Array>} StockAlertItem[] - { product_id, product_name, product_sku,
 *          product_type, category, total_stock, min_stock_alert, deficit }
 */
export const getStockAlerts = async () => {
  try {
    const { data } = await api.get(`${BASE_URL}/stock/alerts`);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching stock alerts:', error);
    throw error;
  }
};

/**
 * Obtener resumen de estadísticas de inventario
 * @returns {Promise<Object>} { totalWarehouses, totalProducts, totalMovements, stockAlerts }
 */
export const getInventoryStats = async () => {
  try {
    const [warehouses, products, movements] = await Promise.all([
      getWarehouses(),
      getProducts(),
      getMovements({ limit: 10 })
    ]);
    
    return {
      totalWarehouses: warehouses.length,
      warehousesByType: {
        CENTRAL: warehouses.filter(w => w.type === 'CENTRAL').length,
        MOBILE: warehouses.filter(w => w.type === 'MOBILE').length,
        VIRTUAL: warehouses.filter(w => w.type === 'VIRTUAL').length,
      },
      totalProducts: products.length,
      productsByType: {
        BULK: products.filter(p => p.type === 'BULK').length,
        SERIALIZED: products.filter(p => p.type === 'SERIALIZED').length,
      },
      recentMovements: movements.slice(0, 10),
      lastMovementDate: movements[0]?.date || null
    };
  } catch (error) {
    console.error('❌ Error fetching inventory stats:', error);
    throw error;
  }
};

// ============================================
// EXPORT DEFAULT (opcional para compatibilidad)
// ============================================

export default {
  // Warehouses
  getWarehouses,
  createWarehouse,
  getWarehouseStock,
  getMyWarehouse,
  
  // Products
  getProducts,
  createProduct,
  
  // Serial Items
  createSerialItem,
  
  // Operations
  transferStock,
  adjustStock,
  
  // Movements
  getMovements,
  
  // Stock Alerts (optimizado)
  getStockAlerts,
  getInventoryStats
};
