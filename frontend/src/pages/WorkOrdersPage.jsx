import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import workOrdersService from '@/services/workOrders.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusConfig = {
  pending_planning: { label: 'Planificación', color: 'bg-amber-500/10 border border-amber-500/40 text-amber-300' },
  assigned: { label: 'Asignada', color: 'bg-blue-500/10 border border-blue-500/40 text-blue-300' },
  scheduled: { label: 'Programada', color: 'bg-blue-500/10 border border-blue-500/40 text-blue-300' },
  in_progress: { label: 'En progreso', color: 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300' },
  completed: { label: 'Completada', color: 'bg-zinc-700/40 border border-zinc-600 text-zinc-200' },
  failed: { label: 'Fallida', color: 'bg-rose-500/10 border border-rose-500/40 text-rose-300' },
};

const otTypeConfig = {
  repair: { label: 'Soporte', color: 'text-emerald-400' },
  install: { label: 'Instalación', color: 'text-blue-400' },
  pickup: { label: 'Retiro', color: 'text-amber-400' },
  infrastructure: { label: 'Infraestructura', color: 'text-purple-400' },
};

function TableView({ items, isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 flex items-center gap-3 text-zinc-400">
        <ClipboardList size={18} className="animate-pulse text-emerald-400" />
        Cargando órdenes...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-zinc-400">
        <p>No hay órdenes de trabajo.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-2xl shadow-black/30">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-zinc-800/60">
            <TableHead className="w-[80px] text-zinc-400">ID</TableHead>
            <TableHead className="text-zinc-400">Estado</TableHead>
            <TableHead className="text-zinc-400">Cliente</TableHead>
            <TableHead className="text-zinc-400">Dirección</TableHead>
            <TableHead className="text-zinc-400">Técnico</TableHead>
            <TableHead className="text-zinc-400">Programada</TableHead>
            <TableHead className="w-[90px] text-center text-zinc-400">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((wo) => (
            <TableRow key={wo.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors">
              <TableCell className="font-mono text-emerald-400">#{wo.id}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-xs ${statusConfig[wo.status]?.color || statusConfig.pending_planning.color}`}>
                  {statusConfig[wo.status]?.label || wo.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-zinc-200">{wo.client_name || 'Sin cliente'}</TableCell>
              <TableCell className="text-sm text-zinc-400 truncate max-w-[220px]">{wo.address || '-'}</TableCell>
              <TableCell className="text-sm text-zinc-400">{wo.technician_name || '-'}</TableCell>
              <TableCell className="text-sm text-zinc-400">
                {wo.scheduled_at ? new Date(wo.scheduled_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={() => navigate(`/app/work-orders/${wo.id}/execute`)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-medium text-sm"
                  title="Ver detalle / Ejecutar"
                >
                  Abrir
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CardView({ items, isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded-lg bg-zinc-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-zinc-400">
        No hay órdenes asignadas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((wo) => (
        <button
          key={wo.id}
          onClick={() => navigate(`/app/work-orders/${wo.id}/execute`)}
          className="w-full text-left p-4 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Clock size={14} />
              {wo.scheduled_at
                ? new Date(wo.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : 'Sin horario'}
            </div>
            <Badge variant="outline" className={`text-[11px] ${statusConfig[wo.status]?.color || statusConfig.pending_planning.color}`}>
              {statusConfig[wo.status]?.label || wo.status}
            </Badge>
          </div>

          <div className="mb-3">
            <p className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
              {wo.address || 'Dirección no disponible'}
            </p>
            <p className="text-sm text-zinc-400 mt-1">{wo.client_name || 'Sin cliente'}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className={otTypeConfig[wo.ot_type]?.color || 'text-zinc-400'}>
                {otTypeConfig[wo.ot_type]?.label || wo.ot_type}
              </span>
              {wo.technician_name && <span>• {wo.technician_name}</span>}
            </div>
            <ChevronRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const isAdmin = useMemo(() => user?.role === 'admin' || user?.role === 'coordinator', [user]);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('auto'); // auto | table | cards
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [otTypeFilter, setOtTypeFilter] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setError('');
      const data = await workOrdersService.listWorkOrders({
        status: statusFilter || undefined,
        ot_type: otTypeFilter || undefined,
        mobile_unit_id: technicianFilter || undefined,
        search: searchQuery || undefined,
        limit: 100,
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Error al cargar OTs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, otTypeFilter, technicianFilter, searchQuery]);
  const visibleItems = useMemo(
    () => items.filter((wo) => (!showUnassigned || !wo.technician_name)),
    [items, showUnassigned]
  );


  const effectiveView = viewMode === 'auto'
    ? (isMobile || user?.role === 'technician' ? 'cards' : 'table')
    : viewMode;

  const pageTitle = isAdmin ? 'Gestión de Órdenes de Trabajo' : 'Mi Ruta de Hoy';
  const pageSubtitle = isAdmin
    ? 'Vista global de todas las OTs, filtra por técnico o estado.'
    : 'Tus órdenes asignadas, listas para ejecutar.';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-zinc-400 mt-1">{pageSubtitle}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setIsRefreshing(true);
            fetchWorkOrders();
          }}
          disabled={isRefreshing}
          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-rose-800/60 bg-rose-950/30">
          <AlertCircle size={18} className="text-rose-400 mt-0.5" />
          <div>
            <p className="text-sm text-rose-100">{error}</p>
            <p className="text-xs text-rose-200/80">Intenta refrescar o ajusta los filtros.</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ID, cliente o dirección"
              className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchWorkOrders();
              }}
            />
          </div>

          {/* Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-emerald-500/40"
          >
            <option value="">Todos los estados</option>
            <option value="pending_planning">Planificación</option>
            <option value="assigned">Asignada</option>
            <option value="scheduled">Programada</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completada</option>
            <option value="failed">Fallida</option>
          </select>

          {/* Tipo */}
          <select
            value={otTypeFilter}
            onChange={(e) => setOtTypeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-emerald-500/40"
          >
            <option value="">Todos los tipos</option>
            <option value="repair">Soporte</option>
            <option value="install">Instalación</option>
            <option value="pickup">Retiro</option>
            <option value="infrastructure">Infraestructura</option>
          </select>

          {/* Técnico (solo admins) */}
          {isAdmin ? (
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-emerald-500/40"
            >
              <option value="">Todos los técnicos</option>
              <option value="1">Unidad 1</option>
              <option value="2">Unidad 2</option>
              <option value="3">Unidad 3</option>
            </select>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        {/* Toggle vista */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="uppercase tracking-wide">Vista</span>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg ${effectiveView === 'table' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg ${effectiveView === 'cards' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('auto')}
              className={`p-1.5 rounded-lg ${viewMode === 'auto' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Zap size={16} />
            </button>
            </div>
            <Button
              variant={showUnassigned ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnassigned((v) => !v)}
              className={showUnassigned ? "bg-emerald-600 hover:bg-emerald-500" : "border-emerald-700 text-emerald-300"}
            >
              Sin asignar
            </Button>
            <div className="text-xs text-zinc-400">{items.length} órdenes</div>
      </div>

      {effectiveView === 'table' ? (
        <TableView items={visibleItems} isLoading={isLoading} />
      ) : (
        <CardView items={visibleItems} isLoading={isLoading} />
      )}

      {!isLoading && !!items.length && (
        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/30 text-center text-xs text-emerald-200">
          Haz clic en una orden para ver detalle y ejecutarla.
        </div>
      )}
    </div>
  );
}
