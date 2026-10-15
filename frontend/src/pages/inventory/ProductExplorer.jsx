import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Loader,
  AlertCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
} from 'lucide-react';
import {
  getProductDetail,
  getProductsAnalytics,
  getProductGroups,
  getWarehouses,
} from '@/services/inventory.service';

const FLOW_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'in_stock', label: 'En stock' },
  { value: 'purchased', label: 'Comprado' },
  { value: 'consumed', label: 'Consumido' },
  { value: 'transferred', label: 'Transferido' },
  { value: 'installed', label: 'Instalado' },
  { value: 'defective', label: 'Defectuoso' },
  { value: 'damaged', label: 'Dañado' },
  { value: 'decommissioned', label: 'Baja' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'BULK', label: 'BULK' },
  { value: 'SERIALIZED', label: 'SERIALIZED' },
];

// Traducciones para el detalle de producto (la UI no debe mostrar inglés).
const SERIAL_STATUS_LABELS = {
  NEW: 'Disponible',
  IN_VEHICLE: 'En móvil',
  INSTALLED: 'Instalado',
  DEFECTIVE: 'Defectuoso',
  DAMAGED: 'Dañado',
  DECOMMISSIONED: 'Baja',
  SOLD: 'Vendido',
};

const MOVEMENT_TYPE_LABELS = {
  PURCHASE: 'Compra',
  TRANSFER: 'Transferencia',
  CONSUMPTION: 'Consumo',
  RECOVERY: 'Recupero',
  ADJUSTMENT: 'Ajuste',
  SALE: 'Venta',
  SALE_RETURN: 'Devolución de venta',
};

const LIMIT = 50;

function sortableHeader({ label, col, current, dir, onSort }) {
  const active = current === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide cursor-pointer hover:text-emerald-300 whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={active ? 'text-emerald-400' : 'text-zinc-600'} />
        {active && <span className="text-emerald-400">{dir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
}

export default function ProductExplorer() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    type: '',
    group_id: '',
    category: '',
    warehouse_id: '',
    flow: '',
    below_min_stock: false,
  });
  const [orderBy, setOrderBy] = useState('name');
  const [orderDir, setOrderDir] = useState('asc');
  const [page, setPage] = useState(0);

  // Detalle de producto (drawer/modal)
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const openDetail = async (productId) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const data = await getProductDetail(productId);
      setDetail(data);
    } catch (err) {
      console.error('Error loading product detail:', err);
      setDetailError('No se pudo cargar el detalle del producto.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailError(null);
  };

  const loadOptions = useCallback(async () => {
    try {
      const [g, w] = await Promise.all([getProductGroups(), getWarehouses()]);
      setGroups(g || []);
      setWarehouses(w || []);
    } catch (e) {
      console.error('Error loading explorer options:', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProductsAnalytics({
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.group_id ? { group_id: filters.group_id } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.warehouse_id ? { warehouse_id: filters.warehouse_id } : {}),
        ...(filters.flow ? { flow: filters.flow } : {}),
        ...(filters.below_min_stock ? { below_min_stock: true } : {}),
        order_by: orderBy,
        order_dir: orderDir,
        limit: LIMIT,
        offset: page * LIMIT,
      });
      setItems(data || []);
    } catch (e) {
      console.error('Error loading product analytics:', e);
      setError('No se pudieron cargar las métricas de productos.');
    } finally {
      setLoading(false);
    }
  }, [filters, orderBy, orderDir, page]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrderDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(col);
      setOrderDir('asc');
    }
    setPage(0);
  };

  const exportCsv = () => {
    const header = [
      'SKU',
      'Nombre',
      'Tipo',
      'Grupo',
      'Disponible',
      'Comprado',
      'Consumido',
      'Transferido',
      'Instalados',
      'Defectuosos',
      'Dañados',
      'Bajas',
      'Bajo mínimo',
    ];
    const rows = items.map((p) => [
      p.sku,
      p.name,
      p.type,
      p.group_name || '',
      p.bulk_in_stock + p.serial_new + p.serial_in_vehicle,
      p.total_purchased,
      p.total_consumed,
      p.total_transferred,
      p.serial_installed,
      p.serial_defective,
      p.serial_damaged,
      p.serial_decommissioned,
      p.below_min_stock ? 'SI' : 'NO',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-explorer.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">Explorador de Productos</h1>
          <p className="text-zinc-400 mt-1">
            Analizá el flujo de items: stock, compras, consumos y seriales en una sola vista.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800 text-sm"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Buscar por nombre o SKU"
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <select
          value={filters.type}
          onChange={(e) => updateFilter('type', e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.group_id}
          onChange={(e) => updateFilter('group_id', e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Todos los grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <select
          value={filters.flow}
          onChange={(e) => updateFilter('flow', e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          {FLOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.warehouse_id}
          onChange={(e) => updateFilter('warehouse_id', e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <input
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          placeholder="Categoría (ej: ONU, CABLE)"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />

        <label className="flex items-center gap-2 text-sm text-zinc-300 col-span-1">
          <input
            type="checkbox"
            checked={filters.below_min_stock}
            onChange={(e) => updateFilter('below_min_stock', e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Solo bajo stock mínimo
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 flex gap-2 text-rose-300 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size={20} className="animate-spin text-emerald-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Package size={32} className="mb-2" />
            <p className="text-sm">No hay productos que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 border-b border-zinc-800">
                <tr>
                  {sortableHeader({ label: 'Producto', col: 'name', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Tipo', col: 'type', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Grupo', col: 'group_name', current: orderBy, dir: orderDir, onSort: handleSort })}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">Disponible</th>
                  {sortableHeader({ label: 'Comprado', col: 'total_purchased', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Consumido', col: 'total_consumed', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Transferido', col: 'total_transferred', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Instalados', col: 'serial_installed', current: orderBy, dir: orderDir, onSort: handleSort })}
                  {sortableHeader({ label: 'Defect.', col: 'serial_defective', current: orderBy, dir: orderDir, onSort: handleSort })}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {items.map((p) => {
                  const available = p.bulk_in_stock + p.serial_new + p.serial_in_vehicle;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openDetail(p.id)}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5">
                        <p className="text-white font-medium">{p.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{p.sku}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${p.type === 'SERIALIZED' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30' : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{p.group_name || '—'}</td>
                      <td className="px-3 py-2.5 text-zinc-200 font-semibold">
                        {Number.isInteger(available) ? available : Number(available.toFixed(2))}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{Number(p.total_purchased)}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{Number(p.total_consumed)}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{Number(p.total_transferred)}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{p.serial_installed}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{p.serial_defective}</td>
                      <td className="px-3 py-2.5">
                        {p.below_min_stock ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">Bajo mínimo</span>
                        ) : (
                          <span className="text-xs text-zinc-500">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-xs text-zinc-500">Página {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={items.length < LIMIT}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs disabled:opacity-40"
            >
              Siguiente
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Detalle de producto (modal) */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-3xl w-full my-8 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-xl font-bold text-emerald-400">
                {detailLoading ? 'Cargando detalle...' : detail?.product?.name || 'Detalle del producto'}
              </h2>
              <button onClick={closeDetail} className="text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {detailError && (
                <div className="p-3 rounded border border-rose-700/50 bg-rose-950/30 text-rose-300 text-sm flex gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{detailError}</span>
                </div>
              )}

              {detailLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader size={20} className="animate-spin text-emerald-400" />
                </div>
              )}

              {detail && !detailLoading && (
                <>
                  <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-zinc-500">SKU:</span> <code className="text-zinc-200">{detail.product.sku}</code></div>
                    <div>
                      <span className="text-zinc-500">Tipo:</span>{' '}
                      <span className="text-zinc-200">
                        {detail.product.type === 'SERIALIZED'
                          ? 'Serializado'
                          : detail.product.type === 'BULK'
                          ? 'A granel'
                          : detail.product.type}
                      </span>
                    </div>
                    <div><span className="text-zinc-500">Grupo:</span> <span className="text-zinc-200">{detail.product.group_name || '—'}</span></div>
                    <div><span className="text-zinc-500">Categoría:</span> <span className="text-zinc-200">{detail.product.category || '—'}</span></div>
                    {detail.product.is_composite && (
                      <>
                        <div><span className="text-zinc-500">Unidad compuesta:</span> <span className="text-zinc-200">{detail.product.composite_unit_label || '—'}</span></div>
                        <div><span className="text-zinc-500">Tamaño:</span> <span className="text-zinc-200">{detail.product.unit_size} {detail.product.unit_measure}</span></div>
                      </>
                    )}
                    {detail.product.barcode_prefix && (
                      <div><span className="text-zinc-500">Prefijo código:</span> <span className="text-zinc-200 font-mono">{detail.product.barcode_prefix}</span></div>
                    )}
                    {detail.product.type === 'BULK' && !detail.product.is_composite && (
                      <div><span className="text-zinc-500">Stock a granel:</span> <span className="text-zinc-200">{detail.bulk_in_stock}</span></div>
                    )}
                    <div>
                      <span className="text-zinc-500">Fecha de compra:</span>{' '}
                      <span className="text-zinc-200">
                        {detail.purchase_date ? new Date(detail.purchase_date).toLocaleDateString('es-AR') : '—'}
                      </span>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Seriales por estado</h3>
                    {Object.keys(detail.serial_summary || {}).length === 0 ? (
                      <p className="text-xs text-zinc-500">Sin seriales registrados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(detail.serial_summary).map(([status, count]) => (
                          <span key={status} className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {SERIAL_STATUS_LABELS[status] || status}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {Array.isArray(detail.serial_items) && detail.serial_items.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Seriales ({detail.serial_items.length})</h3>
                      <div className="overflow-x-auto rounded border border-zinc-800">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-900 text-zinc-400 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">Serial</th>
                              <th className="px-3 py-2 text-left">Estado</th>
                              <th className="px-3 py-2 text-left">Ubicación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/70">
                            {detail.serial_items.map((s) => (
                              <tr key={s.id}>
                                <td className="px-3 py-2 font-mono text-emerald-300">{s.serial_number}</td>
                                <td className="px-3 py-2 text-zinc-300">{SERIAL_STATUS_LABELS[s.status] || s.status}</td>
                                <td className="px-3 py-2 text-zinc-400">{s.warehouse_name || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {Array.isArray(detail.movements) && detail.movements.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Historial de movimientos</h3>
                      <div className="overflow-x-auto rounded border border-zinc-800">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-900 text-zinc-400 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">Fecha</th>
                              <th className="px-3 py-2 text-left">Tipo</th>
                              <th className="px-3 py-2 text-left">Origen → Destino</th>
                              <th className="px-3 py-2 text-left">Cant.</th>
                              <th className="px-3 py-2 text-left">Serial</th>
                              <th className="px-3 py-2 text-left">Ref.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/70">
                            {detail.movements.map((m) => (
                              <tr key={m.id}>
                                <td className="px-3 py-2 text-zinc-400">{m.date ? new Date(m.date).toLocaleString('es-AR') : '—'}</td>
                                <td className="px-3 py-2 text-zinc-300">{MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}</td>
                                <td className="px-3 py-2 text-zinc-400">
                                  {m.from_warehouse_name || '—'} → {m.to_warehouse_name || '—'}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">{m.quantity}</td>
                                <td className="px-3 py-2 font-mono text-emerald-300">{m.serial_number || '—'}</td>
                                <td className="px-3 py-2 text-zinc-500">{m.reference || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
