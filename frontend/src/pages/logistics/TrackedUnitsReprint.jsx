import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader,
  Printer,
  Search,
  CheckSquare,
  Square,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { getTrackedUnits, getTrackedUnitLabelsPdf } from '@/services/logistics.service';
import { getWarehouses } from '@/services/inventory.service';

const STATUS_LABELS = {
  NEW: { label: 'Disponible', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  IN_VEHICLE: { label: 'En móvil', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  INSTALLED: { label: 'Instalado', cls: 'text-purple-300 bg-purple-500/10 border-purple-500/30' },
  DEFECTIVE: { label: 'Defectuoso', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  DAMAGED: { label: 'Dañado', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
  DECOMMISSIONED: { label: 'Baja', cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
  SOLD: { label: 'Vendido', cls: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
};

const PAGE_SIZE = 50;

// Filas por página A4 del PDF de etiquetas (label_h ≈ 29 mm → 9 filas/A4).
// Mantener en sync con label_pdf_service.py (`rows_per_page`).
const ROWS_PER_PAGE = 9;

/**
 * Página de reimpresión múltiple de etiquetas de unidades trazables.
 *
 * - Selección múltiple real (checkbox): click toggles, Shift+click rango,
 *   checkbox de cabecera selecciona toda la página.
 * - Paginación server-side.
 * - "Carrito" persistente: la selección sobrevive cambios de filtro/página y se
 *   puede revisar/editar antes de imprimir.
 */
export default function TrackedUnitsReprint() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [columns, setColumns] = useState(2);
  const [page, setPage] = useState(1);

  // Carrito de impresión (persiste entre páginas/filtros).
  const [selected, setSelected] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const lastIndexRef = useRef(null);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const whs = await getWarehouses();
        setWarehouses((whs || []).filter((w) => w.type === 'CENTRAL' || w.type === 'AUXILIAR'));
      } catch {
        // No bloquea la pantalla si no cargan los depósitos.
      }
    };
    loadWarehouses();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrackedUnits({
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(warehouseId ? { warehouse_id: Number(warehouseId) } : {}),
        ...(status ? { status } : {}),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(Number(data?.total ?? 0));
      lastIndexRef.current = null;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudieron cargar las unidades trazables.');
    } finally {
      setLoading(false);
    }
  }, [search, warehouseId, status, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const isSelected = useCallback(
    (id) => selected.some((it) => it.serial_item_id === id),
    [selected]
  );

  const addToCart = useCallback((item) => {
    setSelected((prev) =>
      prev.some((it) => it.serial_item_id === item.serial_item_id)
        ? prev
        : [...prev, item]
    );
  }, []);

  const removeFromCart = useCallback((serialItemId) => {
    setSelected((prev) => prev.filter((it) => it.serial_item_id !== serialItemId));
  }, []);

  const toggleOne = (item, index, e) => {
    if (e) e.preventDefault();

    if (e?.shiftKey && lastIndexRef.current !== null) {
      const [from, to] = [lastIndexRef.current, index].sort((a, b) => a - b);
      const inRange = items.slice(from, to + 1);
      setSelected((prev) => {
        const next = [...prev];
        for (const it of inRange) {
          if (!next.some((x) => x.serial_item_id === it.serial_item_id)) {
            next.push(it);
          }
        }
        return next;
      });
    } else if (isSelected(item.serial_item_id)) {
      removeFromCart(item.serial_item_id);
    } else {
      addToCart(item);
    }
    lastIndexRef.current = index;
  };

  const allPageSelected = useMemo(
    () => items.length > 0 && items.every((it) => isSelected(it.serial_item_id)),
    [items, isSelected]
  );

  const togglePage = () => {
    if (allPageSelected) {
      setSelected((prev) => prev.filter((it) => !items.some((x) => x.serial_item_id === it.serial_item_id)));
    } else {
      setSelected((prev) => {
        const next = [...prev];
        for (const it of items) {
          if (!next.some((x) => x.serial_item_id === it.serial_item_id)) {
            next.push(it);
          }
        }
        return next;
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagesToPrint = Math.ceil(selected.length / (columns * ROWS_PER_PAGE));

  const handlePrint = async () => {
    if (selected.length === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await getTrackedUnitLabelsPdf(
        selected.map((it) => it.serial_item_id),
        columns
      );
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo generar el PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 pb-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/inventory/adjustments')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ajustes
          </button>

          <h1 className="text-2xl font-bold text-emerald-300">Reimprimir Etiquetas</h1>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              Por fila:
              <select
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por serial, producto o SKU..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Todos los depósitos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, info]) => (
              <option key={value} value={value}>{info.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-3 rounded border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-sm">
              <p>No hay unidades trazables que coincidan con los filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 border-b border-zinc-800">
                  <tr className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    <th className="px-3 py-2 w-10">
                      <button
                        type="button"
                        onClick={togglePage}
                        className="text-zinc-400 hover:text-emerald-300"
                        title={allPageSelected ? 'Deseleccionar página' : 'Seleccionar toda la página'}
                      >
                        {allPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="px-3 py-2">Serial (código de barras)</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Depósito</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {items.map((item, index) => {
                    const st = STATUS_LABELS[item.status] || { label: item.status, cls: 'text-zinc-400' };
                    const checked = isSelected(item.serial_item_id);
                    return (
                      <tr
                        key={item.serial_item_id}
                        onClick={(e) => toggleOne(item, index, e)}
                        className={`cursor-pointer select-none transition-colors ${
                          checked ? 'bg-emerald-900/20' : 'hover:bg-zinc-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="text-emerald-400">
                            {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-emerald-300">
                          {item.serial_number}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-white">{item.product_name || '—'}</p>
                          {item.product_sku && (
                            <p className="text-xs text-zinc-500 font-mono">{item.product_sku}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-300">{item.warehouse_name || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded border ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400 text-xs">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('es-AR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {!loading && totalCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 text-xs text-zinc-400">
              <span>
                {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                <span>Página {page} de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 disabled:opacity-30"
                >
                  Siguiente
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-500 mt-3">
          Click toggles una etiqueta · Shift+Click selecciona rango · El checkbox de cabecera
          selecciona toda la página. La selección se acumula en el lote.
        </p>
      </div>

      {/* Lote de impresión */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(920px,calc(100%-2rem))] z-40">
        <div className="rounded-xl border border-emerald-700/50 bg-zinc-900/95 shadow-2xl shadow-black/50 p-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            <ShoppingCart className="w-4 h-4" />
            Ver lote ({selected.length})
          </button>

          <div className="flex-1 min-w-[200px] text-sm text-zinc-300">
            <p>
              <span className="font-semibold text-emerald-300">{selected.length}</span> etiqueta(s)
              seleccionadas · <span className="font-semibold">≈ {pagesToPrint}</span> página(s) A4
              ({columns} por fila · {ROWS_PER_PAGE} filas)
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={downloading || selected.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            {downloading ? 'Generando PDF…' : 'Imprimir seleccionados'}
          </button>
        </div>
      </div>

      {/* Drawer del carrito */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative w-[min(720px,calc(100%-2rem))] max-h-[80vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-emerald-300">
                Lote de impresión ({selected.length})
              </h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {selected.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-10">
                  No hay etiquetas seleccionadas.
                </p>
              ) : (
                selected.map((it) => (
                  <div
                    key={it.serial_item_id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-zinc-900 border border-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-emerald-300">{it.serial_number}</p>
                      <p className="text-xs text-zinc-400 truncate">{it.product_name || '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(it.serial_item_id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-900/20 rounded"
                      title="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-zinc-400">
                {selected.length} etiqueta(s) · ≈ {pagesToPrint} página(s) A4 ({columns} por fila)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  disabled={selected.length === 0}
                  className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm disabled:opacity-40"
                >
                  Vaciar
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={downloading || selected.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  {downloading ? 'Generando…' : 'Imprimir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
