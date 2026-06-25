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
  AlertCircle,
  Cable,
  Wifi,
  Cpu,
  Wrench,
  Link2,
  Layers,
  Zap,
  Ruler,
  Box,
} from 'lucide-react';

/**
 * Devuelve el ícono y color de acento según la categoría del producto.
 * Mantiene estética Emerald: oscuros + acento por tipo semántico.
 */
function getCategoryIcon(categoryName, isBulk, isComposite) {
  const name = (categoryName || '').toLowerCase();

  // Cableado / fibra / drop / bobina
  if (/cable|fibra|drop|cableado|bobina|coaxial/.test(name)) {
    return { Icon: Cable, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/40' };
  }
  // Routers / networking
  if (/router|routing|mikrotik|networking|red\b/.test(name)) {
    return { Icon: Wifi, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/40' };
  }
  // ONU / ONT / equipos ópticos
  if (/onu|ont|óptic|optic|gpon|epon/.test(name)) {
    return { Icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40' };
  }
  // Conectores / splitters
  if (/conector|splitter|adaptador|acoplador|patch/.test(name)) {
    return { Icon: Link2, color: 'text-cyan-400', bg: 'bg-cyan-900/20 border-cyan-800/40' };
  }
  // Switches / racks
  if (/switch|rack|bandeja/.test(name)) {
    return { Icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-900/20 border-indigo-800/40' };
  }
  // Herramientas / tools
  if (/herramienta|tool|crimpad|pelacable|fusionadora/.test(name)) {
    return { Icon: Wrench, color: 'text-rose-400', bg: 'bg-rose-900/20 border-rose-800/40' };
  }
  // Eléctrico / energía
  if (/eléctric|fuente|ups|poe|electri/.test(name)) {
    return { Icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/40' };
  }
  // Accesorios genéricos
  if (/accesorio|soporte|grapa|cinta|brida/.test(name)) {
    return { Icon: Box, color: 'text-zinc-400', bg: 'bg-zinc-800/40 border-zinc-700/40' };
  }

  // Fallback según tipo
  if (isComposite) return { Icon: Ruler, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/40' };
  if (!isBulk) return { Icon: QrCode, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40' };
  return { Icon: Package, color: 'text-zinc-400', bg: 'bg-zinc-800/40 border-zinc-700/40' };
}

/**
 * Renderiza tabla inteligente de stock
 * @param {Array} items - Array de items de stock con estructura: { product_id, product_name, product_sku, product_type, quantity, serial_count, serial_items, is_composite, unit_measure }
 * @param {Boolean} expandable - Permite expandir filas (default: true)
 * @param {Function} onTransfer - Callback cuando hace click en "Transferir" (optional)
 */
export default function StockTable({
  items = [],
  expandable = true,
  onTransfer = null
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  // Permite ver todos los seriales de una fila (sin límite de 10)
  const [showAllSerials, setShowAllSerials] = useState(new Set());

  const toggleRow = (productId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const toggleShowAll = (productId) => {
    const next = new Set(showAllSerials);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setShowAllSerials(next);
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
    if (item.is_composite) return item.unit_measure || item.composite_unit_label || 'u.';
    if (item.product_type === 'BULK') return item.display_unit || item.composite_unit_label || item.unit_measure || 'u.';
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
        const isShowingAll = showAllSerials.has(item.product_id);
        const isBulk = item.product_type === 'BULK';
        const isComposite = item.is_composite;
        const hasSerials = !isBulk && item.serial_items && item.serial_items.length > 0;
        const serialsToShow = hasSerials
          ? (isShowingAll ? item.serial_items : item.serial_items.slice(0, 10))
          : [];

        const { Icon, color, bg } = getCategoryIcon(item.category, isBulk, isComposite);
        const displayUnit = getDisplayUnit(item);

        return (
          <div
            key={`${item.product_id}-${item.product_type}`}
            className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
          >
            {/* Main Row */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex items-center space-x-4">
                  {/* Expand Button */}
                  {expandable && hasSerials && (
                    <button
                      onClick={() => toggleRow(item.product_id)}
                      className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                      title={isExpanded ? 'Colapsar' : 'Ver seriales'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  {/* Product Icon — category-aware */}
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`p-2 rounded-lg border ${bg}`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-medium truncate">
                          {item.product_name}
                        </h3>
                        {isComposite && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-900/20 border-amber-700/40 text-amber-300 font-mono whitespace-nowrap">
                            TRAZABLE/{(item.unit_measure || 'u.').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs">SKU: {item.product_sku}{item.category ? ` · ${item.category}` : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Type Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border mx-2 whitespace-nowrap ${
                  getProductTypeColor(item.product_type)
                }`}>
                  {getProductTypeLabel(item.product_type)}
                </span>

                {/* Quantity — compuesto muestra metros totales */}
                <div className="text-right mx-4">
                  {isBulk ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-emerald-400">
                        {item.quantity}
                      </span>
                      <span className="text-zinc-400 text-sm">{displayUnit}</span>
                    </div>
                  ) : isComposite && item.serial_items ? (
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="text-2xl font-bold text-amber-400">
                          {item.serial_items.reduce((s, si) => s + (si.remaining_quantity ?? si.initial_quantity ?? 0), 0)}
                        </span>
                        <span className="text-zinc-400 text-sm">{displayUnit}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 text-right">en {item.serial_count} bobina{item.serial_count !== 1 ? 's' : ''}</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-emerald-400">
                        {item.serial_count || 0}
                      </span>
                      <span className="text-zinc-400 text-sm">u.</span>
                    </div>
                  )}
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

            {/* Expanded Content: Serial Items */}
            {expandable && hasSerials && isExpanded && (
              <div className="bg-zinc-800/50 border-t border-zinc-800 p-4">
                <p className="text-xs text-zinc-400 font-medium mb-3">
                  {isComposite
                    ? `Bobinas en este almacén (${item.serial_items.length}):`
                    : `Números de serie en este almacén (${item.serial_items.length}):`}
                </p>
                <div className="space-y-2">
                  {serialsToShow.map((serial) => (
                    <div
                      key={serial.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded border border-zinc-800 hover:border-zinc-700 transition-colors text-sm"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {isComposite ? (
                          <Ruler className="w-4 h-4 text-amber-500/70 flex-shrink-0" />
                        ) : (
                          <QrCode className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                        )}
                        <span className="font-mono text-zinc-200 truncate text-xs">
                          {serial.serial_number}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                        {/* Saldo para compuestos */}
                        {isComposite && (
                          <span className="text-xs font-mono text-amber-300">
                            {serial.remaining_quantity ?? serial.initial_quantity ?? '?'}{' '}
                            <span className="text-zinc-500">{displayUnit}</span>
                            {serial.initial_quantity && serial.remaining_quantity != null &&
                              serial.remaining_quantity < serial.initial_quantity && (
                              <span className="text-zinc-600 ml-1">/{serial.initial_quantity}</span>
                            )}
                          </span>
                        )}
                        {/* Status badge */}
                        <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${
                          serial.status === 'NEW'
                            ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50'
                            : serial.status === 'IN_VEHICLE'
                            ? 'bg-blue-900/30 text-blue-300 border border-blue-800/50'
                            : serial.status === 'INSTALLED'
                            ? 'bg-purple-900/30 text-purple-300 border border-purple-800/50'
                            : 'bg-red-900/30 text-red-300 border border-red-800/50'
                        }`}>
                          {serial.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toggle "Ver todos" / "Colapsar" */}
                {item.serial_items.length > 10 && (
                  <button
                    onClick={() => toggleShowAll(item.product_id)}
                    className="mt-3 w-full py-2 text-xs text-zinc-400 hover:text-emerald-400 border border-zinc-700 hover:border-emerald-700/50 rounded transition-colors"
                  >
                    {isShowingAll
                      ? `▲ Colapsar (mostrar solo 10)`
                      : `▼ Ver todos los ${item.serial_items.length} seriales`}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

