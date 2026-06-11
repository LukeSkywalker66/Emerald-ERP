import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Truck,
  Archive,
  User,
  Package,
  AlertCircle,
  Loader,
  Box,
  Calendar
} from 'lucide-react';
import { getWarehouseStock, getMovements } from '@/services/inventory.service';
import StockTable from '@/components/inventory/StockTable';
import { useAuth } from '@/context/AuthContext';
import Can from '@/components/auth/Can';

export default function WarehouseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('stock');
  const [movements, setMovements] = useState([]);
  const isTechnician = ['tecnico', 'technician'].includes((user?.role || '').toLowerCase());

  useEffect(() => {
    loadWarehouseData();
  }, [id]);

  const loadWarehouseData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [stockData, movementsData] = await Promise.all([
        getWarehouseStock(parseInt(id)),
        getMovements({ warehouse_id: parseInt(id), limit: 20 })
      ]);

      // Aislamiento obligatorio: tecnico solo puede ver su warehouse movil.
      if (isTechnician && Number(stockData?.user_id) !== Number(user?.id)) {
        setError('Acceso denegado: este almacén no pertenece al técnico autenticado');
        setWarehouse(null);
        setMovements([]);
        return;
      }

      setWarehouse(stockData);
      setMovements(movementsData);
    } catch (err) {
      console.error('Error loading warehouse:', err);
      setError('No se pudo cargar el warehouse');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-zinc-400 text-sm">Cargando warehouse...</p>
        </div>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="space-y-6 p-6">
        <Link
          to="/app/inventory/warehouses"
          className="flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Almacenes</span>
        </Link>

        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-6 flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-400 font-semibold mb-1">Error de Conexión</h3>
            <p className="text-red-300/80 text-sm">{error || 'No se encontró el warehouse'}</p>
          </div>
          <button
            onClick={loadWarehouseData}
            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'CENTRAL':
        return <Building2 className="w-6 h-6 text-blue-400" />;
      case 'MOBILE':
        return <Truck className="w-6 h-6 text-emerald-400" />;
      case 'VIRTUAL':
        return <Archive className="w-6 h-6 text-purple-400" />;
      case 'AUXILIAR':
        return <Archive className="w-6 h-6 text-amber-400" />;
      default:
        return <Package className="w-6 h-6 text-zinc-400" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'CENTRAL':
        return 'text-blue-400';
      case 'MOBILE':
        return 'text-emerald-400';
      case 'VIRTUAL':
        return 'text-purple-400';
      case 'AUXILIAR':
        return 'text-amber-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getMovementTypeColor = (type) => {
    const colors = {
      PURCHASE: 'text-emerald-400',
      TRANSFER: 'text-blue-400',
      CONSUMPTION: 'text-red-400',
      ADJUSTMENT: 'text-yellow-400',
      RECOVERY: 'text-purple-400'
    };
    return colors[type] || 'text-zinc-400';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header con botón volver */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/inventory/warehouses"
          className="flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Almacenes</span>
        </Link>
      </div>

      {/* Warehouse Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
              {getTypeIcon(warehouse.warehouse_type)}
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${getTypeColor(warehouse.warehouse_type)}`}>
                {warehouse.warehouse_name}
              </h1>
              <p className="text-zinc-400 mt-2">ID: {warehouse.warehouse_id}</p>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
              warehouse.warehouse_type === 'CENTRAL'
                ? 'bg-blue-900/30 text-blue-300 border-blue-800'
                : warehouse.warehouse_type === 'MOBILE'
                ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800'
                : warehouse.warehouse_type === 'AUXILIAR'
                ? 'bg-amber-900/30 text-amber-300 border-amber-800'
                : 'bg-purple-900/30 text-purple-300 border-purple-800'
            }`}>
              {warehouse.warehouse_type}
            </span>
          </div>
        </div>

        {/* Info adicional */}
        {warehouse.warehouse_type === 'MOBILE' && (
          <div className="mt-4 p-3 bg-emerald-900/10 border border-emerald-800/30 rounded-lg flex items-center space-x-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm">Técnico asignado: ID #{warehouse.user_id || 'N/A'}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'stock'
                ? 'border-b-2 border-emerald-500 text-emerald-400 bg-zinc-800/50'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Stock Actual ({warehouse.items?.length || 0} productos)
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'movements'
                ? 'border-b-2 border-emerald-500 text-emerald-400 bg-zinc-800/50'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Movimientos ({movements.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'stock' && (
            <StockTable items={warehouse.items || []} expandable={true} />
          )}

          {activeTab === 'movements' && (
            <div className="space-y-3">
              {movements.length > 0 ? (
                movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wide ${getMovementTypeColor(mov.movement_type)}`}>
                          {mov.movement_type}
                        </span>
                        <p className="text-white font-medium mt-1">{mov.product_name}</p>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(mov.date).toLocaleDateString()} {new Date(mov.date).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-sm text-zinc-400 space-y-1">
                      {mov.from_warehouse_name && (
                        <p>De: <span className="text-zinc-300">{mov.from_warehouse_name}</span></p>
                      )}
                      {mov.to_warehouse_name && (
                        <p>A: <span className="text-zinc-300">{mov.to_warehouse_name}</span></p>
                      )}
                      {mov.quantity && (
                        <p>Cantidad: <span className="text-emerald-400 font-medium">{mov.quantity}</span></p>
                      )}
                      {mov.serial_number && (
                        <p>Serial: <span className="text-zinc-300 font-mono">{mov.serial_number}</span></p>
                      )}
                    </div>

                    {mov.reference && (
                      <div className="mt-2 p-2 bg-zinc-900/50 rounded text-xs text-zinc-400 border-l-2 border-emerald-500">
                        {mov.reference}
                      </div>
                    )}

                    {mov.user_name && (
                      <p className="mt-2 text-xs text-zinc-500">Por: {mov.user_name}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">Sin movimientos recientes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons (solo roles con permiso de transferencia) */}
      <Can resource="inventory" action="transfer">
        <div className="flex space-x-3">
          <Link
            to="/app/inventory/transfer"
            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium"
          >
            <span>Transferir Stock desde/hacia este almacén</span>
          </Link>
        </div>
      </Can>
    </div>
  );
}
