import { useState, useEffect, useCallback } from 'react';
import * as inventoryService from '@/services/inventory.service';
import workOrdersService from '@/services/workOrders.service';
import coordinationService from '@/services/coordination.service';
import { useAuth } from '@/context/AuthContext';

/**
 * useMaterialSelector - Hook compartido para la selección y gestión de materiales
 *
 * Unifica la lógica que antes estaba duplicada entre:
 *   - WorkOrderExecutionPage (material dialog)
 *   - CloseWorkOrderDialog (step 2 - materiales)
 *
 * Flujo:
 *   1. Carga el catálogo de productos disponibles
 *   2. Carga el warehouse del técnico (camioneta)
 *   3. Carga el stock del warehouse
 *   4. Permite seleccionar producto, ingresar cantidad/serial, y agregar a la OT
 *   5. Refresca stock automáticamente tras cada operación
 *
 * @param {number} workOrderId - ID de la OT a la que agregar materiales
 */
export default function useMaterialSelector(workOrderId) {
  const { user } = useAuth();

  // Catálogo de productos
  const [products, setProducts] = useState([]);

  // Warehouse del técnico
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [warehouseStock, setWarehouseStock] = useState(null);

  // Producto seleccionado y seriales disponibles
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);

  // Form state
  const [form, setForm] = useState({
    product_id: '',
    quantity: 1,
    serial_number: '',
    notes: '',
  });

  // Loading / Error
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Cargar inventario: productos + warehouse + stock
   */
  /**
   * Buscar warehouse del técnico vía team → vehicle → warehouse.
   * La relación correcta es: User → TeamMember → Team → Vehicle → Warehouse(MOBILE).
   * El campo user_id en Warehouse está deprecated.
   */
  const resolveWarehouse = useCallback(async (userId) => {
    // 1. Buscar por team → vehicle → warehouse (relación correcta)
    try {
      const teams = await coordinationService.getUserTeams(userId);
      const teamWithVehicle = (teams || []).find((t) => !!t.vehicle_id);
      if (teamWithVehicle?.vehicle_id) {
        const warehouses = await inventoryService.getWarehouses({
          warehouse_type: 'MOBILE',
        });
        const vehicleWh = warehouses.find((w) => w.vehicle?.id === teamWithVehicle.vehicle_id);
        if (vehicleWh) return vehicleWh;
      }
    } catch (e) {
      console.warn('[useMaterialSelector] Team lookup failed:', e);
    }

    // 2. Fallback: buscar por user_id directo (deprecated)
    try {
      const direct = await inventoryService.getMyWarehouse(userId);
      if (direct) return direct;
    } catch (e) {
      // ignorar
    }

    return null;
  }, []);

  const loadInventory = useCallback(async () => {
    if (!user?.id) return;

    let cancelled = false;

    try {
      setIsLoading(true);
      setError(null);

      const myWarehouse = await resolveWarehouse(user.id);

      if (cancelled) return;
      setCurrentWarehouse(myWarehouse || null);

      if (myWarehouse) {
        const [productsData, stockData] = await Promise.all([
          inventoryService.getProducts(),
          inventoryService.getWarehouseStock(myWarehouse.id),
        ]);
        if (cancelled) return;
        setProducts(productsData || []);
        setWarehouseStock(stockData);
      } else {
        // Sin warehouse: cargar solo productos
        const productsData = await inventoryService.getProducts();
        if (cancelled) return;
        setProducts(productsData || []);
      }
    } catch (err) {
      if (cancelled) return;
      console.error('[useMaterialSelector] Error loading inventory:', err);
      setError(err.message || 'Error al cargar inventario');
    } finally {
      if (!cancelled) setIsLoading(false);
    }

    return () => { cancelled = true; };
  }, [user?.id, resolveWarehouse]);

  /**
   * Refrescar stock del warehouse actual
   */
  const refreshStock = useCallback(async () => {
    if (!currentWarehouse?.id) return;

    try {
      const updatedStock = await inventoryService.getWarehouseStock(currentWarehouse.id);
      setWarehouseStock(updatedStock);

      if (selectedProduct?.type === 'SERIALIZED') {
        const stockItem = updatedStock.items?.find((item) => item.product_id === selectedProduct.id);
        setAvailableSerials(stockItem?.serial_items || []);
      }
    } catch (err) {
      console.error('[useMaterialSelector] Error refreshing stock:', err);
    }
  }, [currentWarehouse?.id, selectedProduct]);

  /**
   * Handler: cambio de producto seleccionado
   */
  const handleProductChange = useCallback((productId) => {
    const product = products.find((p) => p.id === parseInt(productId));
    setSelectedProduct(product);

    setForm((prev) => ({
      ...prev,
      product_id: productId,
      quantity: 1,
      serial_number: '',
    }));

    if (product && product.type === 'SERIALIZED' && warehouseStock) {
      const stockItem = warehouseStock.items?.find((item) => item.product_id === product.id);
      setAvailableSerials(stockItem?.serial_items || []);
    } else {
      setAvailableSerials([]);
    }
  }, [products, warehouseStock]);

  /**
   * Obtener cantidad máxima disponible (para validación)
   */
  const getMaxQuantity = useCallback(() => {
    if (!selectedProduct || !warehouseStock) return 1;
    if (selectedProduct.type === 'BULK') {
      const stockItem = warehouseStock.items?.find((item) => item.product_id === selectedProduct.id);
      return stockItem?.quantity || 1;
    }
    return availableSerials.length || 1;
  }, [selectedProduct, warehouseStock, availableSerials]);

  /**
   * Validar formulario antes de agregar
   */
  const isFormValid = useCallback(() => {
    if (!form.product_id) return false;
    if (selectedProduct?.type === 'BULK') {
      const qty = parseInt(form.quantity, 10);
      return qty > 0 && qty <= getMaxQuantity();
    }
    return !!form.serial_number;
  }, [form.product_id, form.quantity, form.serial_number, selectedProduct, getMaxQuantity]);

  /**
   * Agregar material a la OT
   */
  const addMaterial = useCallback(async () => {
    if (!isFormValid()) return { success: false, error: 'Formulario inválido' };
    if (!currentWarehouse) return { success: false, error: 'No tienes una camioneta asignada' };

    try {
      setIsSubmitting(true);
      setError(null);

      await workOrdersService.addWorkOrderItem(workOrderId, {
        product_id: parseInt(form.product_id, 10),
        quantity: selectedProduct?.type === 'BULK' ? parseInt(form.quantity, 10) || 1 : 1,
        serial_number: selectedProduct?.type === 'SERIALIZED' ? form.serial_number : null,
        notes: form.notes || null,
        warehouse_id: currentWarehouse.id,
      });

      // Refrescar stock después de agregar
      await refreshStock();

      // Resetear formulario
      setForm({ product_id: '', quantity: 1, serial_number: '', notes: '' });
      setSelectedProduct(null);
      setAvailableSerials([]);

      return { success: true };
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || err.message || 'Error al agregar material';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsSubmitting(false);
    }
  }, [workOrderId, currentWarehouse, form, selectedProduct, isFormValid, refreshStock]);

  /**
   * Remover material de la OT
   */
  const removeMaterial = useCallback(async (itemId) => {
    try {
      await workOrdersService.removeWorkOrderItem(workOrderId, itemId);
      await refreshStock();
      return { success: true };
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || err.message || 'Error al eliminar material';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [workOrderId, refreshStock]);

  /**
   * Resetear formulario (para cuando se cierra el dialog)
   */
  const resetForm = useCallback(() => {
    setForm({ product_id: '', quantity: 1, serial_number: '', notes: '' });
    setSelectedProduct(null);
    setAvailableSerials([]);
    setError(null);
  }, []);

  return {
    // Data
    products,
    currentWarehouse,
    warehouseStock,
    selectedProduct,
    availableSerials,
    form,

    // Status
    isLoading,
    isSubmitting,
    error,

    // Actions
    loadInventory,
    refreshStock,
    handleProductChange,
    getMaxQuantity,
    isFormValid,
    addMaterial,
    removeMaterial,
    resetForm,
    setForm,
  };
}
