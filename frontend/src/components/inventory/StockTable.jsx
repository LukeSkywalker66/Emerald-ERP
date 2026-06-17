/**
 * StockTable Component
 * Componente reutilizable que renderiza una tabla inteligente de stock
 * Soporta tanto productos BULK como SERIALIZED
 * Adaptable para diferentes contextos (warehouse detail, dashboard, etc.)
 */
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Package,
  QrCode,
  Droplets,
  AlertCircle
} from 'lucide-react';

/**
 * Renderiza tabla inteligente de stock
 * @param {Array} items - Array de items de stock con estructura: { product_id, product_name, product_sku, product_type, quantity, serial_count, serial_items }
 * @param {Boolean} expandable - Permite expandir filas (default: true)
 * @param {Function} onTransfer - Callback cuando hace click en "Transferir" (optional)
 */
export default function StockTable({
  items = [],
  expandable = true,
  onTransfer = null
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (productId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const getProductTypeLabel = (type) => {
    return type === 'BULK' ? 'A GRANEL' : 'SERIALIZADO';
  };

  const getProductTypeColor = (type) => {
    if (type === 'BULK') {
      return 'bg-blue-900/30 text-blue-300 border-blue-800';
    } else {
      return 'bg-purple-900/30 text-purple-300 border-purple-800';
    }
  };

  const getStockLevelBadge = (quantity, type) => {
    // Para propósitos visuales, consideramos "bajo" si cantidad < 50 para BULK
    // y < 5 para SERIALIZED
    const threshold = type === 'BULK' ? 50 : 5;
    const level = quantity < threshold ? 'low' : 'normal';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        level === 'low'
          ? 'bg-red-900/30 text-red-300 border-red-800'
          : 'bg-emerald-900/30 text-emerald-300 border-emerald-800'
      }`}>
        {level === 'low' && <AlertCircle className="w-3 h-3 mr-1" />}
        {quantity}
      </span>
    );
  };

  const getDisplayUnit = (item) => {
    if (!item) return 'u.';
    if (item.product_type === 'BULK') {
      return item.display_unit || item.composite_unit_label || item.unit_measure || 'u.';
    }
    return 'u.';
  };

  if (!items || items.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
        <Package className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500">No hay productos en stock</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isExpanded = expandedRows.has(item.product_id);
        const isBulk = item.product_type === 'BULK';
        const hasSerials = !isBulk && item.serial_items && item.serial_items.length > 0;

        return (
          <div
            key={`${item.product_id}-${item.product_type}`}
            className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
          >
            {/* Main Row */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex items-center space-x-4">
                  {/* Expand Button (si tiene seriales) */}
                  {expandable && hasSerials && (
                    <button
                      onClick={() => toggleRow(item.product_id)}
                      className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  {/* Product Icon & Info */}
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                      {isBulk ? (
                        <Droplets className="w-5 h-5 text-blue-400" />
                      ) : (
                        <QrCode className="w-5 h-5 text-purple-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {item.product_name}
                      </h3>
                      <p className="text-zinc-500 text-sm">SKU: {item.product_sku}</p>
                    </div>
                  </div>
                </div>

                {/* Type Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border mx-2 whitespace-nowrap ${
                  getProductTypeColor(item.product_type)
                }`}>
                  {getProductTypeLabel(item.product_type)}
                </span>

                {/* Quantity */}
                <div className="text-right mx-4">
                  <div className="flex items-center space-x-2">
                    {isBulk ? (
                      <>
                        <span className="text-2xl font-bold text-emerald-400">
                          {item.quantity}
                        </span>
                        <span className="text-zinc-400 text-sm">{getDisplayUnit(item)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-emerald-400">
                          {item.serial_count || 0}
                        </span>
                        <span className="text-zinc-400 text-sm">u.</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {onTransfer && (
                  <button
                    onClick={() => onTransfer(item)}
                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800 rounded text-sm transition-colors whitespace-nowrap"
                  >
                    Transferir
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Content: Serial Items List */}
            {expandable && hasSerials && isExpanded && (
              <div className="bg-zinc-800/50 border-t border-zinc-800 p-4">
                <p className="text-xs text-zinc-400 font-medium mb-3">
                  Números de serie en este almacén:
                </p>
                <div className="space-y-2">
                  {item.serial_items.slice(0, 10).map((serial) => (
                    <div
                      key={serial.id}
                      className="flex items-center justify-between p-2 bg-zinc-900/50 rounded text-sm"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <QrCode className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                        <span className="font-mono text-zinc-300 truncate">
                          {serial.serial_number}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ml-2 ${
                        serial.status === 'NEW'
                          ? 'bg-emerald-900/30 text-emerald-300'
                          : serial.status === 'USED'
                          ? 'bg-blue-900/30 text-blue-300'
                          : serial.status === 'INSTALLED'
                          ? 'bg-purple-900/30 text-purple-300'
                          : 'bg-red-900/30 text-red-300'
                      }`}>
                        {serial.status}
                      </span>
                    </div>
                  ))}
                  {item.serial_items.length > 10 && (
                    <p className="text-xs text-zinc-500 italic px-2">
                      +{item.serial_items.length - 10} más
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
