import React, { useEffect, useState, useCallback } from 'react';
import {
  Truck,
  Undo2,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as logisticsService from '@/services/logistics.service';
import * as inventoryService from '@/services/inventory.service';

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', color: 'bg-zinc-700 text-zinc-300', icon: Clock },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-yellow-900/30 text-yellow-300 border-yellow-800', icon: RefreshCw },
  COMPLETED: { label: 'Completada', color: 'bg-emerald-900/30 text-emerald-300 border-emerald-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-900/30 text-red-300 border-red-800', icon: XCircle },
};

export default function MaterialDeliveryDashboard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('delivery'); // 'delivery' | 'receipt'
  const [deliveries, setDeliveries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  useEffect(() => {
    loadData();
  }, [mode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'delivery') {
        const deliveriesData = await logisticsService.getDeliveries();
        setDeliveries(deliveriesData || []);
        const uniqueTeams = [...new Set((deliveriesData || []).map(d => d.team_id))];
        setTeams(uniqueTeams.map(id => ({
          id,
          name: (deliveriesData || []).find(d => d.team_id === id)?.team_name || `Cuadrilla #${id}`
        })));
      } else {
        const receiptsData = await logisticsService.getReceipts();
        setReceipts(receiptsData || []);
        const uniqueTeams = [...new Set((receiptsData || []).map(r => r.team_id))];
        setTeams(uniqueTeams.map(id => ({
          id,
          name: (receiptsData || []).find(r => r.team_id === id)?.team_name || `Cuadrilla #${id}`
        })));
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (teamFilter !== 'ALL' && d.team_id !== parseInt(teamFilter)) return false;
    return true;
  });

  const filteredReceipts = receipts.filter(r => {
    if (teamFilter !== 'ALL' && r.team_id !== parseInt(teamFilter)) return false;
    return true;
  });

  const stats = mode === 'delivery' ? {
    total: deliveries.length,
    completed: deliveries.filter(d => d.status === 'COMPLETED').length,
    inProgress: deliveries.filter(d => d.status === 'IN_PROGRESS').length,
    draft: deliveries.filter(d => d.status === 'DRAFT').length,
  } : {
    total: receipts.length,
    completed: receipts.length,
    inProgress: 0,
    draft: 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">
            {mode === 'delivery' ? 'Entregas a Cuadrillas' : 'Recepción de Materiales'}
          </h1>
          <p className="text-zinc-400 mt-1">
            {mode === 'delivery'
              ? 'Transferencia de materiales del depósito central a los móviles'
              : 'Devolución de materiales de los móviles al depósito central'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Mode Toggle */}
          <div className="bg-zinc-800 rounded-lg p-1 flex">
            <button
              onClick={() => setMode('delivery')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                mode === 'delivery'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Entregas</span>
            </button>
            <button
              onClick={() => setMode('receipt')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                mode === 'receipt'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Undo2 className="w-4 h-4" />
              <span>Recepciones</span>
            </button>
          </div>

          <button
            onClick={() => navigate(mode === 'delivery' ? '/app/logistics/deliveries/new' : '/app/logistics/receipts/new')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{mode === 'delivery' ? 'Nueva Entrega' : 'Nueva Recepción'}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-400 text-sm">Totales</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-400 text-sm">{mode === 'delivery' ? 'Completadas' : 'Registradas'}</p>
          <p className={`text-3xl font-bold mt-1 ${mode === 'delivery' ? 'text-emerald-400' : 'text-blue-400'}`}>
            {stats.completed}
          </p>
        </div>
        {mode === 'delivery' && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">En Progreso</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{stats.inProgress}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">Borradores</p>
              <p className="text-3xl font-bold text-zinc-400 mt-1">{stats.draft}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mode === 'delivery' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="IN_PROGRESS">En Progreso</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          )}
          {mode === 'receipt' && <div />}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
          >
            <option value="ALL">Todas las Cuadrillas</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex space-x-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
            {mode === 'delivery' && (
              <button
                onClick={async () => {
                  const drafts = deliveries.filter(d => d.status === 'DRAFT');
                  if (!drafts.length) return;
                  if (!confirm(`¿Cancelar ${drafts.length} entrega(s) en borrador?`)) return;
                  for (const d of drafts) {
                    try { await logisticsService.cancelDelivery(d.id); } catch {}
                  }
                  loadData();
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-red-900/50 text-zinc-300 rounded-lg flex items-center justify-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Limpiar DRAFTs</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button onClick={loadData} className="px-3 py-1 bg-red-900/30 text-red-300 rounded text-sm">Reintentar</button>
        </div>
      )}

      {/* List */}
      {mode === 'delivery' ? (
        filteredDeliveries.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
            <Truck className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">Sin entregas</h3>
            <p className="text-zinc-500 text-sm mb-4">No hay entregas registradas</p>
            <button onClick={() => navigate('/app/logistics/deliveries/new')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              Crear Primera Entrega
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-800/50 border-b border-zinc-800 grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              <div className="col-span-2">ID</div>
              <div className="col-span-3">Cuadrilla</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-2">Items</div>
              <div className="col-span-2">Fecha</div>
              <div className="col-span-1">Acción</div>
            </div>
            <div className="divide-y divide-zinc-800">
              {filteredDeliveries.map((delivery) => {
                const StatusIcon = STATUS_CONFIG[delivery.status]?.icon || Clock;
                return (
                  <div key={delivery.id}
                    className="grid grid-cols-12 gap-4 p-4 hover:bg-zinc-800/50 transition-colors items-center cursor-pointer"
                    onClick={() => navigate(`/app/logistics/deliveries/${delivery.id}`)}
                  >
                    <div className="col-span-2"><code className="text-zinc-400 text-sm">#{delivery.id}</code></div>
                    <div className="col-span-3">
                      <p className="text-white font-medium">{delivery.team_name || `Cuadrilla #${delivery.team_id}`}</p>
                      <p className="text-zinc-500 text-xs">{delivery.warehouse_to_name || ''}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[delivery.status]?.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{STATUS_CONFIG[delivery.status]?.label || delivery.status}</span>
                      </span>
                    </div>
                    <div className="col-span-2"><span className="text-zinc-400 text-sm">{delivery.items?.length || 0} productos</span></div>
                    <div className="col-span-2"><span className="text-zinc-400 text-sm">{new Date(delivery.created_at).toLocaleDateString('es-AR')}</span></div>
                    <div className="col-span-1 flex justify-end"><ChevronRight className="w-5 h-5 text-zinc-500" /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* Receipts mode */
        filteredReceipts.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
            <Undo2 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">Sin recepciones</h3>
            <p className="text-zinc-500 text-sm mb-4">No hay recepciones de materiales registradas</p>
            <button onClick={() => navigate('/app/logistics/receipts/new')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              Nueva Recepción
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-800/50 border-b border-zinc-800 grid grid-cols-12 gap-4 p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              <div className="col-span-2">ID</div>
              <div className="col-span-3">Cuadrilla</div>
              <div className="col-span-2">Items</div>
              <div className="col-span-3">Recibido por</div>
              <div className="col-span-2">Fecha</div>
            </div>
            <div className="divide-y divide-zinc-800">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.id}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-zinc-800/50 transition-colors items-center cursor-pointer"
                  onClick={() => navigate(`/app/logistics/receipts/${receipt.id}`)}
                >
                  <div className="col-span-2"><code className="text-zinc-400 text-sm">#{receipt.id}</code></div>
                  <div className="col-span-3">
                    <p className="text-white font-medium">{receipt.team_name || `Cuadrilla #${receipt.team_id}`}</p>
                    <p className="text-zinc-500 text-xs">{receipt.warehouse_from_name || ''}</p>
                  </div>
                  <div className="col-span-2"><span className="text-zinc-400 text-sm">{receipt.items?.length || 0} productos</span></div>
                  <div className="col-span-3"><span className="text-zinc-400 text-sm">{receipt.received_by_name || '-'}</span></div>
                  <div className="col-span-2"><span className="text-zinc-400 text-sm">{new Date(receipt.received_at).toLocaleDateString('es-AR')}</span></div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
