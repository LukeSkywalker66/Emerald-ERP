/**
 * Servicio de Inventario Operativo - Emerald ERP
 * 
 * Centraliza toda la comunicación con el API de Inventario.
 * Maneja errores, transformación de datos y validación básica.
 * 
 * Endpoints disponibles:
 * - Warehouses: GET/POST /api/inventory/warehouses, GET /{id}/stock
 * - Products: GET/POST /api/inventory/products
 * - Serial Items: POST /api/inventory/serial-items
 * - Operations: POST /api/inventory/transfer, POST /api/inventory/adjustments
 * - Movements: GET /api/inventory/movements
 */
import api from '@/api/client';

const BASE_URL = '/inventory';

// ============================================
// WAREHOUSES
// ============================================

/**
 * Obtener lista de warehouses con filtros opcionales
 * @param {Object} filters - { warehouse_type?, user_id? }
 * @returns {Promise<Array>} Array de warehouses
 */
export const getWarehouses = async (filters = {}) => {
  try {
    const { data } = await api.get(`${BASE_URL}/warehouses`, { params: filters });
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching warehouses:', error);
    throw error;
  }
};

/**
 * Obtener el warehouse MOBILE asignado a un técnico específico.
 * Filtro client-side usando el user_id porque la API devuelve todos los MOBILE.
 * @param {number} userId - ID del usuario técnico logueado
 * @returns {Promise<Object|null>} Warehouse o null si no existe
 */
export const getMyWarehouse = async (userId) => {
  if (!userId) return null;

  try {
    // Compatibilidad: algunos endpoints usan "type" y otros "warehouse_type"
    const warehouses = await getWarehouses({ type: 'MOBILE', warehouse_type: 'MOBILE' });
    return warehouses.find((warehouse) => warehouse.user_id === userId) || null;
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
  try {
    // Los parámetros se pasan como query string (?type=BULK&category=Cableado)
    // axios/api lo maneja automáticamente con { params: filters }
    const { data } = await api.get(`${BASE_URL}/products`, { params: filters });
    console.log('✅ Products fetched with filters:', filters, 'Result count:', data?.length);
    return data || [];
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
// HELPERS / AGGREGATE DATA
// ============================================

/**
 * Calcular productos con stock bajo (helper frontend)
 * Combina datos de productos y warehouses para detectar alertas
 * @returns {Promise<Array>} Productos con stock < min_stock_alert
 */
export const getStockAlerts = async () => {
  try {
    // Obtener todos los productos
    const products = await getProducts();
    
    // Obtener todos los warehouses con stock
    const warehouses = await getWarehouses();
    
    const alerts = [];
    
    for (const product of products) {
      let totalStock = 0;
      
      // Sumar stock de todos los warehouses
      for (const warehouse of warehouses) {
        try {
          const warehouseStock = await getWarehouseStock(warehouse.id);
          const productStock = warehouseStock.items?.find(
            item => item.product_id === product.id
          );
          
          if (productStock) {
            if (product.type === 'BULK') {
              totalStock += productStock.quantity || 0;
            } else if (product.type === 'SERIALIZED') {
              totalStock += productStock.serial_count || 0;
            }
          }
        } catch (error) {
          console.warn(`Warning: Could not fetch stock for warehouse ${warehouse.id}`);
        }
      }
      
      // Si stock total < mínimo configurado, agregar a alertas
      if (totalStock < product.min_stock_alert) {
        alerts.push({
          product,
          totalStock,
          minStock: product.min_stock_alert,
          deficit: product.min_stock_alert - totalStock
        });
      }
    }
    
    return alerts;
  } catch (error) {
    console.error('❌ Error calculating stock alerts:', error);
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
  
  // Helpers
  getStockAlerts,
  getInventoryStats
};
