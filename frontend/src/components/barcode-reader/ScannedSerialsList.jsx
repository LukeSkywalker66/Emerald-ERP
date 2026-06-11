/**
 * ScannedSerialsList — Lista de seriales escaneados con opción de eliminar.
 *
 * Props:
 * @prop {Array} serials - Lista de strings de seriales escaneados
 * @prop {Function} onRemove - Callback para eliminar un serial (recibe el serial)
 * @prop {boolean} readonly - Si es true, no muestra botón de eliminar
 * @prop {string} emptyMessage - Mensaje cuando no hay seriales
 */
import React from 'react';
import { CheckCircle, Trash2, Scan, XCircle } from 'lucide-react';

export default function ScannedSerialsList({
  serials = [],
  onRemove,
  readonly = false,
  emptyMessage = 'No hay seriales escaneados aún',
}) {
  if (serials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
        <Scan className="w-12 h-12 mb-2" />
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
        <p className="text-xs text-zinc-600 mt-1">
          Los seriales escaneados aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">
          Seriales escaneados ({serials.length})
        </h3>
        {serials.length > 0 && (
          <span className="text-xs text-zinc-500">
            Último: {serials[serials.length - 1]}
          </span>
        )}
      </div>

      <div className="bg-zinc-800/30 rounded-lg divide-y divide-zinc-800 max-h-60 overflow-y-auto">
        {serials.map((serial, idx) => (
          <div
            key={`${serial}-${idx}`}
            className="flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <span className="text-zinc-500 text-xs font-mono w-6 flex-shrink-0">
                #{idx + 1}
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <code className="text-white text-sm font-mono truncate">
                {serial}
              </code>
            </div>

            {!readonly && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(serial)}
                className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Eliminar serial"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <span>Total: {serials.length} seriales</span>
        {!readonly && serials.length > 0 && (
          <span className="text-zinc-600">Pass el mouse sobre un serial para eliminarlo</span>
        )}
      </div>
    </div>
  );
}
