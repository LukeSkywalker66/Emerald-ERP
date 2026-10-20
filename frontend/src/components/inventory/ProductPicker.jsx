import React, { useEffect, useRef, useState } from 'react';
import { Loader, Package, Search } from 'lucide-react';
import { searchAvailableStock } from '@/services/inventory.service';

/**
 * ProductPicker — combo de búsqueda de unidades disponibles en un depósito.
 *
 * Lista los items puntuales que el operador puede cargar: seriales individuales
 * (SERIALIZED y compuestos trazables, con su SN) y productos BULK con stock.
 * Mismo concepto que el combo de materiales de las OT.
 *
 * @param {number|null} warehouseId - Depósito de origen (CENTRAL/AUXILIAR), requerido
 * @param {Function} onSelect - Callback que recibe el item seleccionado
 *   { kind: 'serial'|'bulk', serial_item_id?, serial_number?, product_id, ... }
 * @param {string} placeholder
 * @param {boolean} disabled
 */
export default function ProductPicker({
  warehouseId = null,
  onSelect,
  placeholder = 'Buscar item (SN, nombre, grupo o SKU)...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2 || !warehouseId) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchAvailableStock({ q, warehouse_id: Number(warehouseId), limit: 20 });
        setResults(Array.isArray(data) ? data : []);
        setHighlighted(0);
        setOpen(true);
      } catch (err) {
        console.error('ProductPicker search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, warehouseId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectItem = (item) => {
    if (!item) return;
    onSelect(item);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectItem(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 text-sm"
        />
        {loading && (
          <Loader size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((item, index) => (
            <button
              key={item.kind === 'serial' ? `s-${item.serial_item_id}` : `b-${item.product_id}`}
              type="button"
              onClick={() => selectItem(item)}
              onMouseEnter={() => setHighlighted(index)}
              className={`w-full text-left px-4 py-3 transition-colors border-b border-zinc-800/50 last:border-b-0 ${
                index === highlighted ? 'bg-zinc-800' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white truncate">{item.product_name}</p>
                {item.kind === 'serial' ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 border text-purple-300 bg-purple-500/10 border-purple-500/30">
                    SN
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 border text-sky-300 bg-sky-500/10 border-sky-500/30">
                    Bulk
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs text-zinc-400 truncate">
                  {item.group_name || item.category || 'Sin grupo'}
                </p>
                {item.kind === 'serial' ? (
                  <p className="text-xs font-mono text-emerald-300/90 shrink-0">
                    {item.serial_number}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-300 shrink-0">
                    Disponible: {Number(item.available_quantity || 0)} u.
                  </p>
                )}
              </div>

              {item.kind === 'serial' && item.is_composite && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {item.composite_unit_label || 'Unidad compuesta'} · saldo:{' '}
                  {Number(item.remaining_quantity ?? item.unit_size ?? 0)}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && warehouseId && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-400 text-center flex items-center justify-center gap-2">
          <Package size={14} />
          <span>No se encontraron items para "{query}"</span>
        </div>
      )}
    </div>
  );
}
