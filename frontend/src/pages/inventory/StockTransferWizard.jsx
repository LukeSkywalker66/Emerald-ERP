import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  AlertCircle,
  Loader,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';
import * as inventoryService from '@/services/inventory.service';
import TransferFormBulk from '@/components/inventory/TransferFormBulk';
import TransferFormSerialized from '@/components/inventory/TransferFormSerialized';

/**
 * Wizard de 4 pasos para transferencias de stock entre almacenes
 * Flujo: Paso 1 → Origen/Destino/Producto → Paso 2 → Cantidad/Seriales → Paso 3 → Referencia/Notas → Paso 4 → Confirmación
 */
export default function StockTransferWizard() {
  // Estados del Wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datos cargados
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [sourceStock, setSourceStock] = useState(null);

  // Estado del Formulario
  const [formData, setFormData] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: null,
    serial_item_ids: [],
    reference: '',
    notes: '',
  });

  // Estados derivados
  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const sourceWarehouse = warehouses.find(
    (w) => w.id === formData.from_warehouse_id
  );
  const destWarehouse = warehouses.find(
    (w) => w.id === formData.to_warehouse_id
  );
  const isBulk = selectedProduct?.product_type === 'BULK';

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [warehousesData, productsData] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getProducts(),
        ]);

        setWarehouses(warehousesData);
        setProducts(productsData);
      } catch (err) {
        console.error('Error loading transfer wizard data:', err);
        setError('No se pudieron cargar los datos. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Cargar stock del almacén origen cuando cambia
  useEffect(() => {
    const loadSourceStock = async () => {
      if (!formData.from_warehouse_id || !formData.product_id) {
        setSourceStock(null);
        return;
      }

      try {
        const warehouseStock =
          await inventoryService.getWarehouseStock(formData.from_warehouse_id);
        const productStock = warehouseStock.items?.find(
          (item) => item.product_id === formData.product_id
        );
        setSourceStock(productStock || null);
      } catch (err) {
        console.error('Error loading source stock:', err);
        setSourceStock(null);
      }
    };

    loadSourceStock();
  }, [formData.from_warehouse_id, formData.product_id]);

  // Validaciones por paso
  const isStep1Valid = () => {
    if (!formData.product_id) return false;
    if (!formData.from_warehouse_id || !formData.to_warehouse_id) return false;
    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      setError('El almacén origen y destino no pueden ser iguales');
      return false;
    }
    if (!sourceStock) {
      setError(
        'El producto no está disponible en el almacén origen. Selecciona otro.'
      );
      return false;
    }
    setError(null);
    return true;
  };

  const handleStep1Next = () => {
    if (isStep1Valid()) {
      setCurrentStep(2);
      setError(null);
    }
  };

  const handleStep2Next = (data) => {
    setFormData((prev) => ({
      ...prev,
      quantity: data.quantity,
      serial_item_ids: data.serial_item_ids || [],
    }));
    setCurrentStep(3);
  };

  const handleStep3Next = (e) => {
    e.preventDefault();
    setCurrentStep(4);
  };

  const handleStep3Back = () => {
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !sourceWarehouse || !destWarehouse) {
      setError('Datos incompletos. Verifica el formulario.');
      return;
    }

    try {
      setSubmitLoading(true);
      setError(null);

      const payload = {
        product_id: formData.product_id,
        from_warehouse_id: formData.from_warehouse_id,
        to_warehouse_id: formData.to_warehouse_id,
        ...(isBulk && { quantity: formData.quantity }),
        ...(!isBulk && { serial_item_ids: formData.serial_item_ids }),
        reference: formData.reference || null,
        notes: formData.notes || null,
      };

      const result = await inventoryService.transferStock(payload);

      // Éxito - ir a paso 5
      setFormData((prev) => ({
        ...prev,
        result: result,
      }));
      setCurrentStep(5);
    } catch (err) {
      console.error('Error submitting transfer:', err);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        'Error al procesar la transferencia. Intenta nuevamente.';
      setError(errorMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setFormData({
      product_id: '',
      from_warehouse_id: '',
      to_warehouse_id: '',
      quantity: null,
      serial_item_ids: [],
      reference: '',
      notes: '',
    });
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-300">Cargando asistente de transferencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Transferencia de Stock
          </h1>
          <p className="text-zinc-400">
            Asistente paso a paso para transferencias de stock
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step < currentStep
                      ? 'bg-emerald-500 text-white'
                      : step === currentStep
                      ? 'bg-emerald-400 text-zinc-900'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {step < currentStep ? '✓' : step}
                </div>
                {step < 5 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Detalles</span>
            <span>Confirmar</span>
            <span>Resultado</span>
          </div>
        </div>

        {/* Paso 1: Origen, Destino, Producto */}
        {currentStep === 1 && (
          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-8 space-y-6">
            <h2 className="text-2xl font-bold text-emerald-400">
              Paso 1: Selecciona Producto y Almacenes
            </h2>

            {error && (
              <div className="p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Producto *
              </label>
              <select
                value={formData.product_id}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    product_id: parseInt(e.target.value) || '',
                  }))
                }
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecciona un producto...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku}) -{' '}
                    {product.product_type === 'BULK' ? 'A Granel' : 'Serializado'}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="bg-zinc-700/30 border border-emerald-500/20 rounded-lg p-4">
                <p className="text-sm text-zinc-400">Tipo de Producto</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {isBulk ? '📦 A Granel (BULK)' : '🔢 Serializado'}
                </p>
              </div>
            )}

            {/* Almacén Origen */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Almacén Origen *
              </label>
              <select
                value={formData.from_warehouse_id}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    from_warehouse_id: parseInt(e.target.value) || '',
                  }))
                }
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecciona almacén origen...</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Almacén Destino */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Almacén Destino *
              </label>
              <select
                value={formData.to_warehouse_id}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    to_warehouse_id: parseInt(e.target.value) || '',
                  }))
                }
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecciona almacén destino...</option>
                {warehouses
                  .filter(
                    (w) =>
                      w.id !== formData.from_warehouse_id ||
                      formData.from_warehouse_id === ''
                  )
                  .map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.type})
                    </option>
                  ))}
              </select>
            </div>

            {/* Botón Siguiente */}
            <button
              onClick={handleStep1Next}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2 mt-8"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Paso 2: Cantidad o Seriales */}
        {currentStep === 2 && (
          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-emerald-400 mb-6">
              Paso 2: Especifica Cantidad o Seriales
            </h2>

            {isBulk ? (
              <TransferFormBulk
                product={selectedProduct}
                sourceWarehouse={sourceWarehouse}
                sourceStock={sourceStock}
                onSubmit={handleStep2Next}
                isLoading={submitLoading}
              />
            ) : (
              <TransferFormSerialized
                product={selectedProduct}
                sourceWarehouse={sourceWarehouse}
                serialItems={sourceStock?.serial_items || []}
                onSubmit={handleStep2Next}
                isLoading={submitLoading}
              />
            )}

            {/* Botón Volver */}
            <button
              onClick={() => setCurrentStep(1)}
              className="w-full mt-4 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 rounded transition-colors"
            >
              Volver
            </button>
          </div>
        )}

        {/* Paso 3: Referencia y Notas */}
        {currentStep === 3 && (
          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-emerald-400 mb-6">
              Paso 3: Información Adicional
            </h2>

            <form onSubmit={handleStep3Next} className="space-y-4">
              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reference: e.target.value,
                    }))
                  }
                  placeholder="Ej: Carga camioneta técnico Juan, Preparación obra #2025-010"
                  maxLength="200"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  {formData.reference.length}/200 caracteres
                </p>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Información adicional sobre la transferencia..."
                  rows="4"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={handleStep3Back}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 rounded transition-colors"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Paso 4: Confirmación */}
        {currentStep === 4 && (
          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-emerald-400 mb-6">
              Paso 4: Confirma los Datos
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Resumen */}
            <div className="space-y-4 mb-8">
              <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                <p className="text-sm text-zinc-400">Producto</p>
                <p className="text-lg font-semibold text-white">
                  {selectedProduct.name}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  SKU: {selectedProduct.sku}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                  <p className="text-sm text-zinc-400">Origen</p>
                  <p className="text-lg font-semibold text-white">
                    {sourceWarehouse.name}
                  </p>
                </div>
                <ArrowRight className="text-emerald-400 flex-shrink-0" />
                <div className="flex-1 bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                  <p className="text-sm text-zinc-400">Destino</p>
                  <p className="text-lg font-semibold text-white">
                    {destWarehouse.name}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                <p className="text-sm text-zinc-400">
                  {isBulk ? 'Cantidad' : 'Seriales'}
                </p>
                <p className="text-lg font-semibold text-emerald-400">
                  {isBulk
                    ? `${formData.quantity} unidades`
                    : `${formData.serial_item_ids.length} seriales`}
                </p>
              </div>

              {formData.reference && (
                <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                  <p className="text-sm text-zinc-400">Referencia</p>
                  <p className="text-white">{formData.reference}</p>
                </div>
              )}

              {formData.notes && (
                <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
                  <p className="text-sm text-zinc-400">Notas</p>
                  <p className="text-white whitespace-pre-wrap">
                    {formData.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep(3)}
                disabled={submitLoading}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-semibold py-3 rounded transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2"
              >
                {submitLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Transferencia
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Paso 5: Resultado */}
        {currentStep === 5 && (
          <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            </div>

            <h2 className="text-2xl font-bold text-emerald-400 mb-2">
              ✅ Transferencia Exitosa
            </h2>

            <p className="text-zinc-300 mb-6">
              La transferencia se ha registrado correctamente en el sistema.
            </p>

            <div className="bg-zinc-700/30 border border-emerald-500/20 rounded-lg p-4 mb-8 text-left space-y-2">
              <p className="text-sm text-zinc-400">
                Movimiento ID:{' '}
                <span className="text-white font-mono">
                  {formData.result?.movements_created?.[0]?.id || 'N/A'}
                </span>
              </p>
              <p className="text-sm text-zinc-400">
                {formData.result?.message}
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => (window.location.href = '/app/inventory')}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 rounded transition-colors"
              >
                Ir al Dashboard
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Nueva Transferencia
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
