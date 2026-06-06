import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * MaterialSelectorForm - Componente compartido de selección y carga de materiales
 *
 * Renderiza el formulario de selección de producto (BULK o SERIALIZED)
 * con cantidad/serial y notas. Se usa tanto en:
 *   - WorkOrderExecutionPage (dentro de un Dialog)
 *   - CloseWorkOrderDialog (inline en step 2)
 *
 * Props:
 *   - materialState: estado devuelto por useMaterialSelector()
 *   - onAdd: callback al agregar material
 *   - compact: modo compacto (sin labels extra, para inline en wizard)
 */
export default function MaterialSelectorForm({ materialState, onAdd, compact = false }) {
  const {
    products,
    currentWarehouse,
    warehouseStock,
    selectedProduct,
    availableSerials,
    form,
    isLoading,
    isSubmitting,
    error,
    handleProductChange,
    getMaxQuantity,
    isFormValid,
    setForm,
  } = materialState;

  return (
    <div className="space-y-3">
      {/* Loading indicator */}
      {isLoading && (
        <div className="text-sm text-zinc-400 flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full" />
          Cargando productos...
        </div>
      )}

      {/* Warehouse info */}
      {!isLoading && currentWarehouse && (
        <div className={`${compact ? 'text-xs' : 'text-sm'} text-emerald-200 bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3`}>
          📦 Stock desde: <span className="font-semibold text-emerald-300">{currentWarehouse.name}</span>
        </div>
      )}

      {!currentWarehouse && !isLoading && (
        <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-800/50 rounded-lg p-3">
          ⚠️ No tienes una camioneta asignada. Contacta a coordinación.
        </div>
      )}

      {/* Error messages */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800 text-rose-200 text-xs rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Product selector */}
      {!isLoading && products.length > 0 && currentWarehouse && (
        <div>
          {!compact && (
            <label className="text-xs font-medium text-zinc-300 block mb-2">
              Producto *
            </label>
          )}
          <select
            value={form.product_id}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Selecciona un producto...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku}) - {product.type === 'BULK' ? '📦' : '🔢'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Product info */}
      {selectedProduct && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
          <p className="text-xs text-zinc-400">
            Tipo:{' '}
            <span className="text-emerald-400 font-medium">
              {selectedProduct.type === 'BULK' ? '📦 A Granel' : '🔢 Serializado'}
            </span>
          </p>
          {selectedProduct.category && (
            <p className="text-xs text-zinc-400 mt-1">Categoría: {selectedProduct.category}</p>
          )}
          {warehouseStock && (
            <p className="text-xs text-emerald-300 mt-2 font-medium">
              {selectedProduct.type === 'BULK'
                ? `Stock disponible: ${getMaxQuantity()} unidades`
                : `Disponibles: ${availableSerials.length} seriales`}
            </p>
          )}
        </div>
      )}

      {/* Quantity (solo BULK) */}
      {selectedProduct && selectedProduct.type === 'BULK' && (
        <div>
          {!compact && (
            <label className="text-xs font-medium text-zinc-300 block mb-2">
              Cantidad *
            </label>
          )}
          <input
            type="number"
            min="1"
            max={getMaxQuantity()}
            value={form.quantity}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quantity: parseInt(e.target.value, 10) }))
            }
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {compact && (
            <p className="text-xs text-zinc-500 mt-1">
              Disp: <span className="text-emerald-400 font-medium">{getMaxQuantity()} uni.</span>
            </p>
          )}
        </div>
      )}

      {/* Serial selector (solo SERIALIZED) */}
      {selectedProduct && selectedProduct.type === 'SERIALIZED' && (
        <div>
          {!compact && (
            <label className="text-xs font-medium text-zinc-300 block mb-2">
              Serial *
            </label>
          )}
          {availableSerials.length > 0 ? (
            <select
              value={form.serial_number}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, serial_number: e.target.value }))
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecciona un serial...</option>
              {availableSerials.map((serial) => (
                <option key={serial.id} value={serial.serial_number}>
                  {serial.serial_number} - {serial.status}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-200 text-xs">
              ⚠️ No hay seriales disponibles en tu inventario para este producto
            </div>
          )}
          {compact && availableSerials.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              Disp: <span className="text-emerald-400 font-medium">{availableSerials.length} seriales</span>
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {selectedProduct && (
        <div>
          {!compact && (
            <label className="text-xs font-medium text-zinc-300 block mb-2">
              Notas (opcional)
            </label>
          )}
          <textarea
            value={form.notes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            rows={compact ? 1 : 2}
            placeholder="Observaciones sobre el material..."
          />
        </div>
      )}

      {/* Add button */}
      {currentWarehouse && (
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={onAdd}
            disabled={!isFormValid() || isSubmitting || !currentWarehouse}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Agregando...' : 'Agregar material'}
          </Button>
        </div>
      )}
    </div>
  );
}
