import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader, AlertCircle, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as inventoryService from '@/services/inventory.service';

/**
 * Dashboard de Alertas de Stock Bajo
 * Muestra productos con stock por debajo del mínimo configurado
 */
export default function StockAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'critical', 'warning'

  // Cargar datos y calcular alertas
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener todos los productos
        const productsData = await inventoryService.getProducts();

        // Obtener todos los warehouses con stock
        const warehousesData = await inventoryService.getWarehouses();

        const alertsData = [];

        // Iterar sobre cada producto y calcular stock total
        for (const product of productsData) {
          let totalStock = 0;

          // Sumar stock de todos los warehouses
          for (const warehouse of warehousesData) {
            try {
              const warehouseStock = await inventoryService.getWarehouseStock(
                warehouse.id
              );
              const productStock = warehouseStock.items?.find(
                (item) => item.product_id === product.id
              );
              
              if (productStock) {
                if (product.product_type === 'BULK') {
                  totalStock += productStock.quantity || 0;
                } else {
                  // SERIALIZED: contar serial items
                  totalStock += productStock.serial_items?.length || 0;
                }
              }
            } catch (err) {
              console.error(
                `Error loading stock for product ${product.id} in warehouse ${warehouse.id}:`,
                err
              );
            }
          }

          // Crear alerta si stock < min_stock_alert
          const minStock = product.min_stock_alert || 0;
          if (totalStock <= minStock) {
            const deficit = minStock - totalStock;
            const severity = deficit >= minStock * 0.5 ? 'critical' : 'warning';

            alertsData.push({
              id: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              type: product.product_type,
              current_stock: totalStock,
              min_stock: minStock,
              deficit: deficit,
              severity: severity,
            });
          }
        }

        // Ordenar por déficit (más críticos primero)
        alertsData.sort((a, b) => b.deficit - a.deficit);

        setAlerts(alertsData);
      } catch (err) {
        console.error('Error loading stock alerts:', err);
        setError('Error al cargar las alertas. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  // Filtrar alertas según selección
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'critical') {
      return alert.severity === 'critical';
    }
    if (filter === 'warning') {
      return alert.severity === 'warning';
    }
    return true;
  });

  const handleRepone = (product) => {
    // Navegar a StockAdjustments y pasar el producto en state
    navigate('/app/inventory/adjustments', {
      state: {
        prefilledProductId: product.id,
        prefilledProductName: product.name,
      },
    });
  };

  const getSeverityColor = (severity) => {
    return severity === 'critical'
      ? { bg: 'bg-ruby-500/20', border: 'border-ruby-500/50', text: 'text-ruby-400', badge: 'bg-ruby-500/30 text-ruby-300' }
      : { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', badge: 'bg-amber-500/30 text-amber-300' };
  };

  const getProductIcon = (type) => {
    return type === 'BULK' ? '📦' : '🔢';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-300">Calculando alertas de stock...</p>
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
            <AlertTriangle className="w-8 h-8 text-ruby-400" />
            <h1 className="text-4xl font-bold text-white">Alertas de Stock</h1>
          </div>
          <p className="text-zinc-400">
            {filteredAlerts.length} producto{filteredAlerts.length !== 1 ? 's' : ''} por debajo del
            mínimo configurado
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-ruby-500/20 border border-ruby-500/50 rounded-lg p-4">
            <p className="text-sm text-ruby-400">Alertas Críticas</p>
            <p className="text-3xl font-bold text-white">
              {alerts.filter((a) => a.severity === 'critical').length}
            </p>
          </div>
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4">
            <p className="text-sm text-amber-400">Advertencias</p>
            <p className="text-3xl font-bold text-white">
              {alerts.filter((a) => a.severity === 'warning').length}
            </p>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-lg p-4">
            <p className="text-sm text-emerald-400">Total de Alertas</p>
            <p className="text-3xl font-bold text-white">{alerts.length}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            Todas ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              filter === 'critical'
                ? 'bg-ruby-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            Críticas ({alerts.filter((a) => a.severity === 'critical').length})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              filter === 'warning'
                ? 'bg-amber-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            Advertencias ({alerts.filter((a) => a.severity === 'warning').length})
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-ruby-500/20 border border-ruby-500/50 rounded-lg flex gap-3 text-ruby-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Alertas Grid */}
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-800/50 border border-emerald-500/30 rounded-lg">
            <AlertTriangle className="w-16 h-16 text-emerald-400 mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-semibold text-zinc-300 mb-2">
              {filter === 'all' ? 'Sin alertas de stock' : `Sin alertas ${filter}`}
            </h3>
            <p className="text-zinc-400">
              {filter === 'all'
                ? 'Todos los productos tienen stock suficiente'
                : 'No hay alertas en esta categoría'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAlerts.map((alert) => {
              const colors = getSeverityColor(alert.severity);
              const stockPercentage = Math.max(
                0,
                Math.min(100, (alert.current_stock / alert.min_stock) * 100)
              );

              return (
                <div
                  key={alert.id}
                  className={`${colors.bg} border ${colors.border} rounded-lg p-5 hover:shadow-lg transition-shadow`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getProductIcon(alert.type)}</span>
                        <h3 className="text-lg font-semibold text-white truncate">
                          {alert.name}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">{alert.sku}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${colors.badge} whitespace-nowrap ml-2`}
                    >
                      {alert.severity === 'critical' ? '🔴 CRÍTICO' : '🟡 ADVERTENCIA'}
                    </span>
                  </div>

                  {/* Info de Categoría */}
                  <p className="text-xs text-zinc-400 mb-3">Categoría: {alert.category}</p>

                  {/* Stock Meter */}
                  <div className="mb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-sm text-zinc-300">
                        Stock Actual: <span className={`font-bold ${colors.text}`}>{alert.current_stock}</span>
                      </p>
                      <p className="text-xs text-zinc-400">
                        Mínimo: {alert.min_stock}
                      </p>
                    </div>
                    <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          alert.severity === 'critical'
                            ? 'bg-ruby-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${stockPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Déficit */}
                  <div className={`${colors.bg} rounded p-3 mb-4 border ${colors.border}`}>
                    <p className="text-xs text-zinc-400">Déficit</p>
                    <p className={`text-2xl font-bold ${colors.text}`}>-{alert.deficit}</p>
                  </div>

                  {/* Botón Reponer */}
                  <button
                    onClick={() => handleRepone(alert)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Reponer Stock
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabla Alternativa (para pantallas grandes) */}
        {filteredAlerts.length > 0 && (
          <div className="mt-8 bg-zinc-800/50 border border-emerald-500/30 rounded-lg p-6 hidden lg:block">
            <h2 className="text-lg font-semibold text-emerald-400 mb-4">Vista Tabular</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-700">
                  <tr className="text-zinc-400">
                    <th className="text-left py-3 px-3 font-semibold">Producto</th>
                    <th className="text-left py-3 px-3 font-semibold">Categoría</th>
                    <th className="text-left py-3 px-3 font-semibold">Tipo</th>
                    <th className="text-right py-3 px-3 font-semibold">Stock Actual</th>
                    <th className="text-right py-3 px-3 font-semibold">Mínimo</th>
                    <th className="text-right py-3 px-3 font-semibold">Déficit</th>
                    <th className="text-center py-3 px-3 font-semibold">Estado</th>
                    <th className="text-center py-3 px-3 font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => {
                    const colors = getSeverityColor(alert.severity);
                    return (
                      <tr
                        key={alert.id}
                        className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{alert.name}</span>
                            <span className="text-zinc-400 text-xs font-mono">{alert.sku}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-zinc-300 text-xs">{alert.category}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs">
                            {alert.type === 'BULK' ? '📦 Granel' : '🔢 Serial'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">
                          {alert.current_stock}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">
                          {alert.min_stock}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${colors.text}`}>
                          -{alert.deficit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors.badge}`}
                          >
                            {alert.severity === 'critical' ? '🔴 Crítico' : '🟡 Advertencia'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleRepone(alert)}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-medium"
                          >
                            Reponer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
