import React from 'react';
import { Button } from '@/components/ui/button';
import { Ruler } from 'lucide-react';

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

  const isCompositeTracked =
    selectedProduct?.is_composite && Array.isArray(availableSerials) && availableSerials.length > 0;

  const selectedSerial =
    isCompositeTracked && form.serial_number
      ? availableSerials.find((s) => s.serial_number === form.serial_number)
      : null;

  // Saldo máximo: del serial seleccionado, o del producto si aún no hay serial elegido
  const maxCompositeQty =
    selectedSerial != null
      ? (selectedSerial.remaining_quantity ?? selectedSerial.initial_quantity ?? selectedProduct?.unit_size ?? 1)
      : (selectedProduct?.unit_size ?? 1);

  // Total de metros disponibles sumando todos los seriales compuestos en el almacén
  const totalAvailableBase = isCompositeTracked
    ? availableSerials.reduce((sum, s) => sum + (s.remaining_quantity ?? s.initial_quantity ?? 0), 0)
    : 0;

  const unitLabel = selectedProduct?.unit_measure || selectedProduct?.composite_unit_label || 'u.';

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
          ⚠️ No se encontró un depósito móvil asignado. Podés seleccionar productos pero no agregarlos hasta tener un vehículo asignado.
        </div>
      )}

      {/* Error messages */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800 text-rose-200 text-xs rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Product selector — filtra a productos con stock en el almacén */}
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
                {product.name} ({product.sku}) -{' '}
                {product.type === 'BULK'
                  ? '📦'
                  : product.is_composite
                  ? '📐'
                  : '🔢'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Product info — compuesto vs normal */}
      {selectedProduct && (
        <div className={`border rounded-lg p-3 ${
          isCompositeTracked
            ? 'bg-blue-950/20 border-blue-700/40'
            : 'bg-zinc-800/50 border-zinc-700'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Tipo:{' '}
              <span className="text-emerald-400 font-medium">
                {selectedProduct.type === 'BULK'
                  ? '📦 A Granel'
                  : isCompositeTracked
                  ? `📐 Trazable por ${unitLabel}`
                  : '🔢 Serializado'}
              </span>
            </p>
            {selectedProduct.category?.name && (
              <p className="text-xs text-zinc-500">{selectedProduct.category.name}</p>
            )}
          </div>

          {/* Stock disponible — diferenciado por tipo */}
          {warehouseStock && (
            <div className="mt-2">
              {selectedProduct.type === 'BULK' && !isCompositeTracked ? (
                <p className="text-xs text-emerald-300 font-medium">
                  Stock disponible: <span className="font-bold">{getMaxQuantity()}</span> {unitLabel}
                </p>
              ) : isCompositeTracked ? (
                <div className="flex items-center gap-2">
                  <Ruler size={12} className="text-blue-400" />
                  <p className="text-xs text-blue-300 font-medium">
                    <span className="font-bold">{totalAvailableBase} {unitLabel}</span> disponibles
                    {' '}({availableSerials.length} {availableSerials.length === 1 ? 'bobina' : 'bobinas'})
                  </p>
                </div>
              ) : (
                <p className="text-xs text-emerald-300 font-medium">
                  Disponibles: <span className="font-bold">{availableSerials.length}</span> unidades serializadas
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quantity (solo BULK) */}
      {selectedProduct && selectedProduct.type === 'BULK' && !isCompositeTracked && (
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
              Disp: <span className="text-emerald-400 font-medium">{getMaxQuantity()} {unitLabel}</span>
            </p>
          )}
        </div>
      )}

      {/* Serial selector (solo SERIALIZED) */}
      {selectedProduct && (selectedProduct.type === 'SERIALIZED' || isCompositeTracked) && (
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
                  {isCompositeTracked
                    ? `${serial.serial_number} — ${serial.remaining_quantity ?? serial.initial_quantity ?? '?'} ${unitLabel} disponibles`
                    : `${serial.serial_number} — ${serial.status}`}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-200 text-xs">
              ⚠️ No hay seriales disponibles en tu inventario para este producto
            </div>
          )}
          {compact && availableSerials.length > 0 && !isCompositeTracked && (
            <p className="text-xs text-zinc-500 mt-1">
              Disp: <span className="text-emerald-400 font-medium">{availableSerials.length} seriales</span>
            </p>
          )}

          {/* Saldo del serial compuesto seleccionado */}
          {isCompositeTracked && selectedSerial && (
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-blue-950/30 border border-blue-800/40">
              <Ruler size={12} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-200">
                Saldo de esta bobina:{' '}
                <span className="text-blue-300 font-bold">{maxCompositeQty} {unitLabel}</span>
                {selectedSerial.initial_quantity && selectedSerial.remaining_quantity < selectedSerial.initial_quantity && (
                  <span className="text-zinc-500 ml-1">
                    (de {selectedSerial.initial_quantity} {unitLabel} originales)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cantidad fraccionaria (SERIALIZED + compuesto) — aparece después de elegir serial */}
      {isCompositeTracked && (
        <div>
          <label className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-blue-300 block mb-2`}>
            ¿Cuántos {unitLabel} usaste? *
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={maxCompositeQty}
            value={form.quantity}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || '' }))
            }
            placeholder={`Ej: 30`}
            className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-1 ${
              !form.serial_number
                ? 'border-zinc-700 opacity-50 cursor-not-allowed'
                : 'border-blue-700/50 focus:border-blue-500 focus:ring-blue-500'
            }`}
            disabled={!form.serial_number}
          />
          {!form.serial_number && (
            <p className="text-xs text-zinc-500 mt-1">Seleccioná primero la bobina a usar.</p>
          )}
          {form.serial_number && (
            <p className="text-xs text-zinc-500 mt-1">
              Máximo disponible en esta bobina: <span className="text-blue-300 font-medium">{maxCompositeQty} {unitLabel}</span>
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
