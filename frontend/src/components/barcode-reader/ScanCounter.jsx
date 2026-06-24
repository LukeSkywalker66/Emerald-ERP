/**
 * ScanCounter — Contador visual de seriales escaneados.
 *
 * Props:
 * @prop {number} count - Cantidad actual de seriales escaneados
 * @prop {number} [total] - Total esperado (opcional, muestra barra de progreso)
 * @prop {string} label - Label del contador (ej: "SN ingresados")
 * @prop {string} productName - Nombre del producto
 */
import React from 'react';
import { Package, CheckCircle } from 'lucide-react';

export default function ScanCounter({
  count = 0,
  total = null,
  label = 'Seriales ingresados',
  productName = '',
}) {
  const hasTotal = total !== null && total > 0;
  const percentage = hasTotal ? Math.min(100, (count / total) * 100) : 0;
  const isComplete = hasTotal && count >= total;

  return (
    <div className="bg-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`text-2xl font-bold font-mono ${
              isComplete ? 'text-emerald-400' : 'text-white'
            }`}
          >
            {count}
          </span>
          {hasTotal && (
            <span className="text-zinc-500 text-sm">/ {total}</span>
          )}
          {isComplete && (
            <CheckCircle className="w-5 h-5 text-emerald-400 ml-1" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      {hasTotal && (
        <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* Product name */}
      {productName && (
        <p className="text-xs text-zinc-500 mt-2 truncate">{productName}</p>
      )}
    </div>
  );
}
