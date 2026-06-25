import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Warehouse as WarehouseIcon, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Truck,
  Archive,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getInventoryStats, getStockAlerts } from '@/services/inventory.service';

export default function InventoryDashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [statsData, alertsData] = await Promise.all([
        getInventoryStats(),
        getStockAlerts()
      ]);
      
      setStats(statsData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Error loading inventory dashboard:', err);
      setError('No se pudo cargar el dashboard de inventario');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 text-sm">Consultando al Orquestador...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-zinc-900 border border-red-900/50 rounded-lg p-6 max-w-md">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-semibold mb-1">Error de Conexión</h3>
              <p className="text-zinc-400 text-sm">{error}</p>
              <button
                onClick={loadDashboardData}
                className="mt-4 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-md text-sm transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Almacenes Totales',
      value: stats?.totalWarehouses || 0,
      detail: `${stats?.warehousesByType.CENTRAL || 0} principal, ${stats?.warehousesByType.MOBILE || 0} móviles, ${stats?.warehousesByType.AUXILIAR || 0} auxiliares`,
      icon: WarehouseIcon,
      color: 'emerald',
      link: '/app/inventory/warehouses'
    },
    {
      label: 'Productos en Catálogo',
      value: stats?.totalProducts || 0,
      detail: `${stats?.productsByType.BULK || 0} a granel, ${stats?.productsByType.SERIALIZED || 0} serializados`,
      icon: Package,
      color: 'blue',
      link: '/app/inventory/products'
    },
    {
      label: 'Alertas de Stock',
      value: alerts.length,
      detail: alerts.length > 0 ? 'Requieren atención' : 'Todo OK',
      icon: AlertTriangle,
      color: alerts.length > 0 ? 'red' : 'emerald',
      link: '/app/inventory/alerts'
    },
    {
      label: 'Movimientos Recientes',
      value: stats?.recentMovements?.length || 0,
      detail: stats?.lastMovementDate ? `Último: ${new Date(stats.lastMovementDate).toLocaleDateString()}` : 'Sin actividad',
      icon: Activity,
      color: 'purple',
      link: '/app/inventory/movements'
    }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">
            Inventario Operativo
          </h1>
          <p className="text-zinc-400 mt-1">
            Gestión de almacenes, stock y materiales del ISP
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Link
            to="/app/inventory/adjustments"
            className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800 rounded-lg transition-colors flex items-center space-x-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Registrar Compra</span>
          </Link>
          
          <Link
            to="/app/inventory/transfer"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Nueva Transferencia</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => (
          <Link
            key={idx}
            to={metric.link}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg bg-${metric.color}-900/20 border border-${metric.color}-800/50`}>
                <metric.icon className={`w-6 h-6 text-${metric.color}-400`} />
              </div>
              <ArrowUpRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-zinc-400">{metric.label}</p>
              <p className="text-3xl font-bold text-white">{metric.value}</p>
              <p className="text-xs text-zinc-500">{metric.detail}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warehouses Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <WarehouseIcon className="w-5 h-5 text-emerald-400" />
            <span>Almacenes por Tipo</span>
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-blue-400" />
                <span className="text-zinc-300">Centrales</span>
              </div>
              <span className="text-xl font-bold text-white">{stats?.warehousesByType.CENTRAL || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span className="text-zinc-300">Móviles (Técnicos)</span>
              </div>
              <span className="text-xl font-bold text-white">{stats?.warehousesByType.MOBILE || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Archive className="w-5 h-5 text-amber-400" />
                <span className="text-zinc-300">Auxiliares</span>
              </div>
              <span className="text-xl font-bold text-white">{stats?.warehousesByType.AUXILIAR || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Archive className="w-5 h-5 text-purple-400" />
                <span className="text-zinc-300">Virtuales</span>
              </div>
              <span className="text-xl font-bold text-white">{stats?.warehousesByType.VIRTUAL || 0}</span>
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <AlertTriangle className={`w-5 h-5 ${alerts.length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
            <span>Alertas de Stock</span>
          </h3>
          
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-900/20 border border-emerald-800 flex items-center justify-center mb-3">
                <AlertTriangle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-medium">Todo OK</p>
              <p className="text-xs text-zinc-500 mt-1">Sin productos bajo mínimo</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 5).map((alert, idx) => (
                <div key={idx} className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-300">{alert.product_name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">SKU: {alert.product_sku}</p>
                    </div>
                    <span className="text-xs font-mono text-red-400 bg-red-900/30 px-2 py-1 rounded">
                      -{alert.deficit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-2 text-xs">
                    <span className="text-zinc-500">Stock: {alert.total_stock}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">Mín: {alert.min_stock_alert}</span>
                  </div>
                </div>
              ))}
              
              {alerts.length > 5 && (
                <Link
                  to="/app/inventory/alerts"
                  className="block text-center text-sm text-emerald-400 hover:text-emerald-300 mt-3"
                >
                  Ver {alerts.length - 5} más →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent Movements */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <span>Últimos Movimientos</span>
          </h3>
          
          {stats?.recentMovements?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-zinc-500 text-sm">Sin movimientos recientes</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats?.recentMovements?.slice(0, 5).map((movement, idx) => {
                const typeColors = {
                  PURCHASE: 'emerald',
                  TRANSFER: 'blue',
                  CONSUMPTION: 'red',
                  ADJUSTMENT: 'yellow',
                  RECOVERY: 'purple'
                };
                const color = typeColors[movement.movement_type] || 'zinc';
                
                return (
                  <div key={idx} className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-xs font-medium text-${color}-400 uppercase tracking-wide`}>
                        {movement.movement_type}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(movement.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 truncate">{movement.product_name}</p>
                    {movement.reference && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">{movement.reference}</p>
                    )}
                  </div>
                );
              })}
              
              <Link
                to="/app/inventory/movements"
                className="block text-center text-sm text-emerald-400 hover:text-emerald-300 mt-3"
              >
                Ver historial completo →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-emerald-800/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            to="/app/inventory/warehouses"
            className="p-4 bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg transition-all group"
          >
            <WarehouseIcon className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-white font-medium">Gestionar Almacenes</p>
            <p className="text-xs text-zinc-400 mt-1">Ver y crear warehouses</p>
          </Link>
          
          <Link
            to="/app/inventory/products"
            className="p-4 bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg transition-all group"
          >
            <Package className="w-8 h-8 text-blue-400 mb-2" />
            <p className="text-white font-medium">Catálogo de Productos</p>
            <p className="text-xs text-zinc-400 mt-1">Gestionar productos</p>
          </Link>
          
          <Link
            to="/app/inventory/transfer"
            className="p-4 bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg transition-all group"
          >
            <ArrowUpRight className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-white font-medium">Transferir Stock</p>
            <p className="text-xs text-zinc-400 mt-1">Mover entre almacenes</p>
          </Link>
          
          <Link
            to="/app/inventory/movements"
            className="p-4 bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg transition-all group"
          >
            <Activity className="w-8 h-8 text-yellow-400 mb-2" />
            <p className="text-white font-medium">Ver Auditoría</p>
            <p className="text-xs text-zinc-400 mt-1">Historial de movimientos</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
