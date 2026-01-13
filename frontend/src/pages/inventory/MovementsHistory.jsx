import React, { useState, useEffect } from 'react';
import { Calendar, Filter, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import * as inventoryService from '@/services/inventory.service';

/**
 * Página de Auditoría - Historial completo de movimientos de stock
 * Filtra por: Rango de fechas, Tipo de Movimiento, Producto, Almacén
 * Incluye paginación (limit/offset)
 */
export default function MovementsHistory() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    movement_type: '',
    product_id: '',
    warehouse_id: '',
  });

  // Paginación
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0,
  });

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [productsData, warehousesData] = await Promise.all([
          inventoryService.getProducts(),
          inventoryService.getWarehouses(),
        ]);

        setProducts(productsData);
        setWarehouses(warehousesData);
      } catch (err) {
        console.error('Error loading audit data:', err);
        setError('No se pudieron cargar los datos iniciales.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Cargar movimientos cuando cambian filtros o paginación
  useEffect(() => {
    const loadMovements = async () => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = {
          limit: pagination.limit,
          offset: pagination.offset,
          ...(filters.movement_type && { movement_type: filters.movement_type }),
          ...(filters.product_id && { product_id: filters.product_id }),
          ...(filters.warehouse_id && { warehouse_id: filters.warehouse_id }),
          // Las fechas se envían al backend si está implementado
          ...(filters.start_date && { start_date: filters.start_date }),
          ...(filters.end_date && { end_date: filters.end_date }),
        };

        const movementsData = await inventoryService.getMovements(queryParams);
        setMovements(movementsData);
      } catch (err) {
        console.error('Error loading movements:', err);
        setError('Error al cargar los movimientos. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadMovements();
  }, [filters, pagination]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Reset a primera página cuando se cambia un filtro
    setPagination((prev) => ({
      ...prev,
      offset: 0,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      movement_type: '',
      product_id: '',
      warehouse_id: '',
    });
    setPagination({
      limit: 25,
      offset: 0,
      total: 0,
    });
  };

  const handlePrevPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  const handleNextPage = () => {
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  };

  const getMovementBadge = (type) => {
    const badges = {
      PURCHASE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '📦 Compra', icon: '↑' },
      TRANSFER: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '🔄 Transferencia', icon: '→' },
      CONSUMPTION: { bg: 'bg-ruby-500/20', text: 'text-ruby-400', label: '📤 Consumo', icon: '↓' },
      ADJUSTMENT: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '⚙️ Ajuste', icon: '±' },
    };
    return badges[type] || { bg: 'bg-zinc-600/20', text: 'text-zinc-400', label: '❓ Otro', icon: '?' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  if (loading && movements.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-300">Cargando historial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white">Auditoría de Movimientos</h1>
          </div>
          <p className="text-zinc-400">
            Historial completo: "¿Quién movió qué, cuándo y dónde?"
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-400">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Fecha Desde */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Desde</label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Hasta</label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Tipo de Movimiento */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Tipo</label>
              <select
                name="movement_type"
                value={filters.movement_type}
                onChange={handleFilterChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todos</option>
                <option value="PURCHASE">📦 Compra</option>
                <option value="TRANSFER">🔄 Transferencia</option>
                <option value="CONSUMPTION">📤 Consumo</option>
                <option value="ADJUSTMENT">⚙️ Ajuste</option>
              </select>
            </div>

            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Producto</label>
              <select
                name="product_id"
                value={filters.product_id}
                onChange={handleFilterChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Almacén */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Almacén</label>
              <select
                name="warehouse_id"
                value={filters.warehouse_id}
                onChange={handleFilterChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todos</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botón Reset */}
          <button
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Tabla de Movimientos */}
        <div className="bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-emerald-400 mb-4">
            Resultados ({movements.length} registros)
          </h2>

          {movements.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No hay movimientos que coincidan con los filtros</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-700">
                    <tr className="text-zinc-400">
                      <th className="text-left py-3 px-3 font-semibold">Fecha/Hora</th>
                      <th className="text-left py-3 px-3 font-semibold">Usuario</th>
                      <th className="text-left py-3 px-3 font-semibold">Tipo</th>
                      <th className="text-left py-3 px-3 font-semibold">Producto</th>
                      <th className="text-left py-3 px-3 font-semibold">Flujo</th>
                      <th className="text-right py-3 px-3 font-semibold">Cantidad</th>
                      <th className="text-left py-3 px-3 font-semibold">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const badge = getMovementBadge(movement.movement_type);
                      const fromWarehouse = movement.from_warehouse?.name || '-';
                      const toWarehouse = movement.to_warehouse?.name || '-';

                      return (
                        <tr
                          key={movement.id}
                          className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                        >
                          <td className="py-3 px-3 whitespace-nowrap text-zinc-300">
                            {formatDate(movement.created_at)}
                          </td>
                          <td className="py-3 px-3 text-zinc-300">
                            {movement.created_by_user?.email || 'Sistema'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text} whitespace-nowrap`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="text-white font-medium">
                                {movement.product?.name}
                              </span>
                              <span className="text-zinc-400 text-xs">
                                {movement.product?.sku}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-300">{fromWarehouse}</span>
                              <span className="text-emerald-400">→</span>
                              <span className="text-zinc-300">{toWarehouse}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span
                              className={
                                movement.movement_type === 'PURCHASE' ||
                                movement.movement_type === 'ADJUSTMENT'
                                  ? 'text-emerald-400'
                                  : movement.movement_type === 'CONSUMPTION'
                                  ? 'text-ruby-400'
                                  : 'text-blue-400'
                              }
                            >
                              {movement.movement_type === 'PURCHASE' ||
                              movement.movement_type === 'ADJUSTMENT'
                                ? '+'
                                : '-'}
                              {movement.quantity || movement.serial_item_ids?.length || '-'}
                              {movement.unit ? ` ${movement.unit}` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-400 text-xs max-w-xs truncate">
                            {movement.reference || movement.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="mt-6 flex items-center justify-between border-t border-zinc-700 pt-4">
                <p className="text-sm text-zinc-400">
                  Página {currentPage} • Mostrando {Math.min(pagination.limit, movements.length)} de{' '}
                  {movements.length} registros
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={pagination.offset === 0}
                    className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={movements.length < pagination.limit}
                    className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
