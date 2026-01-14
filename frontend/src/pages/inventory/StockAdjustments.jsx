import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, AlertCircle, Loader } from 'lucide-react';
import * as inventoryService from '@/services/inventory.service';

/**
 * Página para registrar ajustes de stock (Compras, Correcciones)
 * Formulario simple + tabla histórica de movimientos
 */
export default function StockAdjustments() {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [formData, setFormData] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '',
    movement_type: 'PURCHASE',
    reference: '',
    notes: '',
  });

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📦 StockAdjustments: Iniciando carga de datos...');

        // Obtener warehouses y productos BULK (solo a granel permitido)
        const warehousesData = await inventoryService.getWarehouses();
        console.log('✅ Warehouses cargados:', warehousesData);
        setWarehouses(warehousesData || []);

        // Server-side filtering: el backend filtra solo productos BULK
        const productsData = await inventoryService.getProducts({ type: 'BULK' });
        console.log('✅ Productos BULK cargados (server-side filtered):', productsData);
        setProducts(productsData || []);

        const movementsData = await inventoryService.getMovements();
        console.log('✅ Movimientos cargados:', movementsData);
        setMovements(movementsData || []);

        console.log('✅ Todos los datos cargados exitosamente');
      } catch (err) {
        console.error('❌ Error loading adjustment data:', err);
        console.error('Error status:', err.response?.status);
        console.error('Error message:', err.response?.data?.detail || err.message);
        console.error('Full error object:', err);
        
        const errorMessage = err.response?.data?.detail 
          || err.message 
          || 'No se pudieron cargar los datos. Intenta nuevamente.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.product_id || !formData.warehouse_id || !formData.quantity) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (parseInt(formData.quantity) <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }

    try {
      setSubmitLoading(true);
      setError(null);

      const result = await inventoryService.adjustStock({
        product_id: parseInt(formData.product_id),
        warehouse_id: parseInt(formData.warehouse_id),
        quantity: parseInt(formData.quantity),
        movement_type: formData.movement_type,
        reference: formData.reference || null,
        notes: formData.notes || null,
      });

      setSuccessMessage(
        `✅ Ajuste registrado correctamente. ID: ${result.movement_id}`
      );

      // Resetear formulario
      setFormData({
        product_id: '',
        warehouse_id: '',
        quantity: '',
        movement_type: 'PURCHASE',
        reference: '',
        notes: '',
      });

      // Recargar movimientos
      const updatedMovements = await inventoryService.getMovements({
        movement_type: 'PURCHASE,ADJUSTMENT',
        limit: 20,
      });
      setMovements(updatedMovements);

      // Limpiar mensaje después de 5s
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error submitting adjustment:', err);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        'Error al registrar el ajuste. Intenta nuevamente.';
      setError(errorMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const getMovementBadge = (type) => {
    const badges = {
      PURCHASE: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        label: '🛒 Compra',
      },
      ADJUSTMENT: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        label: '⚙️ Ajuste',
      },
    };
    return badges[type] || badges.ADJUSTMENT;
  };

  const selectedProduct = products.find(
    (p) => p.id === parseInt(formData.product_id)
  );
  const selectedWarehouse = warehouses.find(
    (w) => w.id === parseInt(formData.warehouse_id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-300">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Plus className="w-8 h-8 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white">
              Ajustes y Compras de Stock
            </h1>
          </div>
          <p className="text-zinc-400">
            Registra nuevas compras o correcciones de stock a granel
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6 text-emerald-400">
                Nuevo Ajuste
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Producto */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Producto *
                  </label>
                  <select
                    name="product_id"
                    value={formData.product_id}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un producto...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <p className="text-xs text-zinc-400 mt-2">
                      Categoría: {selectedProduct.category}
                    </p>
                  )}
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Almacén Destino *
                  </label>
                  <select
                    name="warehouse_id"
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un almacén...</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="1"
                    step="1"
                    placeholder="Ingresa cantidad"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Tipo de Movimiento */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Tipo de Movimiento
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="movement_type"
                        value="PURCHASE"
                        checked={formData.movement_type === 'PURCHASE'}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">🛒 Compra</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="movement_type"
                        value="ADJUSTMENT"
                        checked={formData.movement_type === 'ADJUSTMENT'}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">⚙️ Ajuste</span>
                    </label>
                  </div>
                </div>

                {/* Referencia */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Referencia (ej: PO-2025-123)
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={handleInputChange}
                    placeholder="Número de orden, factura, etc."
                    maxLength="200"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Información adicional..."
                    rows="3"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50 text-white font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {submitLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Registrar Ajuste
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Tabla de Histórico */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6 text-emerald-400">
                Últimos Ajustes (20 registros)
              </h2>

              {movements.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    No hay ajustes registrados aún
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-700">
                      <tr className="text-zinc-400">
                        <th className="text-left py-3 px-3 font-semibold">
                          Tipo
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Producto
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Almacén
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Cantidad
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Referencia
                        </th>
                        <th className="text-left py-3 px-3 font-semibold">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => {
                        const badge = getMovementBadge(movement.movement_type);
                        const moveDate = new Date(
                          movement.created_at
                        ).toLocaleDateString('es-AR');

                        return (
                          <tr
                            key={movement.id}
                            className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {movement.product?.name}
                                </span>
                                <span className="text-zinc-400 text-xs">
                                  {movement.product?.sku}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-zinc-300">
                              {movement.to_warehouse?.name}
                            </td>
                            <td className="py-3 px-3 text-right font-mono">
                              <span className="text-emerald-400">
                                +{movement.quantity}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-zinc-400 text-xs">
                              {movement.reference || '-'}
                            </td>
                            <td className="py-3 px-3 text-zinc-400 text-xs">
                              {moveDate}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
