import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Componente Helper para Transferencias BULK
 * Permite seleccionar cantidad con validación en tiempo real
 */
export default function TransferFormBulk({
  product,
  sourceWarehouse,
  sourceStock,
  onSubmit,
  isLoading = false,
}) {
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState(null);

  // Validar cantidad disponible
  const availableQuantity = sourceStock?.quantity || 0;
  const isValid =
    quantity && parseInt(quantity) > 0 && parseInt(quantity) <= availableQuantity;

  const handleChange = (e) => {
    const value = e.target.value;
    setQuantity(value);
    setError(null);

    // Validación en tiempo real
    if (value && parseInt(value) > availableQuantity) {
      setError(
        `Stock insuficiente. Disponible: ${availableQuantity}${sourceStock?.unit || ''}`
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isValid) {
      setError('Ingresa una cantidad válida');
      return;
    }

    onSubmit({
      quantity: parseInt(quantity),
      serial_item_ids: null, // BULK no usa seriales
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info del Producto */}
      <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">Producto Seleccionado</p>
        <p className="text-lg font-semibold text-white">{product.name}</p>
        <p className="text-sm text-zinc-400 mt-2">
          SKU: <span className="font-mono text-emerald-400">{product.sku}</span>
        </p>
      </div>

      {/* Info del Almacén Origen */}
      <div className="bg-zinc-700/30 border border-zinc-600/50 rounded-lg p-4">
        <p className="text-sm text-zinc-400">Almacén Origen</p>
        <p className="text-lg font-semibold text-white">
          {sourceWarehouse.name}
        </p>
        <p className="text-sm text-emerald-400 mt-2">
          Stock Disponible:{' '}
          <span className="text-2xl font-bold">
            {availableQuantity}
            {sourceStock?.unit}
          </span>
        </p>
      </div>

      {/* Input de Cantidad */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Cantidad a Transferir *
        </label>
        <input
          type="number"
          value={quantity}
          onChange={handleChange}
          min="1"
          max={availableQuantity}
          step="1"
          placeholder="Ingresa cantidad"
          className="w-full bg-zinc-700 border border-zinc-600 rounded px-4 py-2 text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-lg font-semibold"
        />
        <p className="text-xs text-zinc-400 mt-2">
          Máximo disponible: {availableQuantity}
          {sourceStock?.unit}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-2 text-ruby-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:opacity-50 text-white font-semibold py-2 rounded transition-colors"
      >
        {isLoading ? 'Procesando...' : 'Siguiente'}
      </button>
    </form>
  );
}
