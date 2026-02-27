import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ClipboardList,
  RefreshCw,
  Search,
  ExternalLink,
  Wrench,
  Package,
  Home,
  Zap,
  Users,
  User,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import api from '@/api/client';
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

// Config: Estados
const STATUS_CONFIG = {
  pending_planning: { 
    label: 'Planificación', 
    variant: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  },
  assigned: { 
    label: 'Asignada', 
    variant: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  },
  in_progress: { 
    label: 'En curso', 
    variant: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  },
  completed: { 
    label: 'Completada', 
    variant: 'bg-zinc-700/40 border-zinc-600 text-zinc-300',
  },
  failed: { 
    label: 'Fallida', 
    variant: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
};

// Config: Tipos de OT
const TYPE_CONFIG = {
  repair: { label: 'Soporte', icon: Wrench, color: 'text-emerald-400' },
  install: { label: 'Instalación', icon: Home, color: 'text-blue-400' },
  pickup: { label: 'Retiro', icon: Package, color: 'text-amber-400' },
  infrastructure: { label: 'Infraestructura', icon: Zap, color: 'text-purple-400' },
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Roles que ven columnas adicionales (Programada, Creada, Asignada)
  const canSeeAdminColumns = useMemo(() => 
    user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'operator' || user?.role === 'super_user',
    [user]
  );

  // Roles que pueden filtrar por técnico (solo admin y operator)
  const canFilterByTechnician = useMemo(() => 
    user?.role === 'admin' || user?.role === 'operator',
    [user]
  );

  // Detectar si es técnico (para bifurcación de fetch)
  const isTechnician = useMemo(() => user?.role === 'tecnico', [user]);

  // State
  const [workOrders, setWorkOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [technicians, setTechnicians] = useState([]); // Lista de técnicos disponibles

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Load data - BIFURCACIÓN POR ROL (NASA-GRADE)
  const loadWorkOrders = async () => {
    try {
      setError(null);

      let items = [];

      if (isTechnician) {
        // ========== TÉCNICOS: Agenda del día (my-schedule) ==========
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const { data } = await api.get('/v2/work-orders/my-schedule', {
          params: { date: today },
        });
        items = Array.isArray(data) ? data : [];
      } else {
        // ========== ADMIN/COORDINADOR: Vista global con filtros ==========
        const data = await workOrdersService.listWorkOrders({
          status: statusFilter || undefined,
          ot_type: typeFilter || undefined,
          search: searchQuery || undefined,
          limit: 100,
        });
        items = data.items || [];

        // Extraer técnicos únicos de las OTs (solo para admin)
        const uniqueTechnicians = Array.from(
          new Set(
            items
              .filter(wo => wo.technician_name)
              .map(wo => wo.technician_name)
          )
        ).sort();
        setTechnicians(uniqueTechnicians);

        // Filtro por asignación (solo admins)
        if (assigneeFilter === 'unassigned') {
          items = items.filter((wo) => !wo.technician_name);
        } else if (assigneeFilter === 'assigned') {
          items = items.filter((wo) => !!wo.technician_name);
        } else if (assigneeFilter && assigneeFilter !== '') {
          // Filtro por técnico específico
          items = items.filter((wo) => wo.technician_name === assigneeFilter);
        }
      }

      setWorkOrders(items);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error al cargar OTs');
      console.error('Error loading work orders:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, searchQuery, assigneeFilter]);

  // Formatear fecha
  const formatScheduledDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 mb-2">
            <ClipboardList size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-400 tracking-wide uppercase">
              {canSeeAdminColumns ? 'Gestión de OTs' : 'Mi Ruta'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {canSeeAdminColumns ? 'Órdenes de Trabajo' : 'Mis Órdenes Asignadas'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {canSeeAdminColumns 
              ? 'Vista global de todas las órdenes técnicas'
              : 'Tus tareas programadas para ejecutar'
            }
          </p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setIsRefreshing(true);
            loadWorkOrders();
          }}
          disabled={isRefreshing}
          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-rose-800/60 bg-rose-950/30">
          <AlertCircle size={18} className="text-rose-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-rose-100">{error}</p>
            <p className="text-xs text-rose-200/80 mt-1">
              Intenta refrescar o ajusta los filtros.
            </p>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Búsqueda */}
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, cliente o dirección..."
              className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-9"
            />
          </div>

          {/* Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/40 h-9"
          >
            <option value="">Todos los estados</option>
            <option value="pending_planning">Planificación</option>
            <option value="assigned">Asignada</option>
            <option value="in_progress">En curso</option>
            <option value="completed">Completada</option>
            <option value="failed">Fallida</option>
          </select>

          {/* Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/40 h-9"
          >
            <option value="">Todos los tipos</option>
            <option value="repair">Soporte</option>
            <option value="install">Instalación</option>
            <option value="pickup">Retiro</option>
            <option value="infrastructure">Infraestructura</option>
          </select>

          {/* Filtro por asignado (solo admin y operator) */}
          {canFilterByTechnician && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/40 h-9"
            >
              <option value="">Todos los técnicos</option>
              <option value="unassigned">Sin asignar</option>
              <option value="assigned">Asignado</option>
              {technicians.length > 0 && <option disabled>─────────────</option>}
              {technicians.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          <span>{workOrders.length} órdenes encontradas</span>
          <span>Click en una fila para abrir</span>
        </div>

        {/* Legend de tipos */}
        <div className="flex flex-wrap gap-4 pt-2 text-xs">
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-center gap-2 text-zinc-400">
                <Icon size={16} className={config.color} />
                <span>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-2xl shadow-black/30">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-zinc-400">
            <RefreshCw size={18} className="animate-spin text-emerald-400" />
            Cargando órdenes de trabajo...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <ClipboardList size={32} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm">No se encontraron órdenes de trabajo</p>
            <p className="text-xs mt-1">Intenta ajustar los filtros</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-zinc-800/80 hover:bg-transparent">
                <TableHead className="w-[70px] text-zinc-400 font-semibold">ID</TableHead>
                <TableHead className="w-[60px] text-zinc-400 font-semibold">Tipo</TableHead>
                <TableHead className="w-[120px] text-zinc-400 font-semibold">Estado</TableHead>
                <TableHead className="text-zinc-400 font-semibold">Cliente</TableHead>
                <TableHead className="text-zinc-400 font-semibold">Dirección</TableHead>
                <TableHead className="w-[140px] text-zinc-400 font-semibold">Programada</TableHead>
                {canSeeAdminColumns && (
                  <TableHead className="w-[130px] text-zinc-400 font-semibold">Creada</TableHead>
                )}
                {canSeeAdminColumns && (
                  <TableHead className="w-[140px] text-zinc-400 font-semibold">Asignada</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {workOrders.map((wo) => {
                const typeConfig = TYPE_CONFIG[wo.ot_type] || TYPE_CONFIG.repair;
                const TypeIcon = typeConfig.icon;
                const statusConfig = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending_planning;

                return (
                  <TableRow
                    key={wo.id}
                    onClick={() => navigate(`/app/work-orders/${wo.id}/execute`)}
                    className="border-b border-zinc-800/40 hover:bg-zinc-800/60 cursor-pointer transition-colors group"
                  >
                    {/* ID */}
                    <TableCell className="font-mono text-emerald-400 font-medium">
                      #{wo.id}
                    </TableCell>

                    {/* Tipo - solo icono */}
                    <TableCell>
                      <div className="flex items-center justify-center" title={typeConfig.label}>
                        <TypeIcon size={18} className={typeConfig.color} />
                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-xs border ${statusConfig.variant}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </TableCell>

                    {/* Cliente */}
                    <TableCell className="text-sm text-zinc-200 max-w-[180px] truncate">
                      {wo.client_name || 'Sin cliente'}
                    </TableCell>

                    {/* Dirección */}
                    <TableCell className="text-sm text-zinc-400 max-w-[220px] truncate">
                      {wo.address || '-'}
                    </TableCell>

                    {/* Fecha programada - visible para todos */}
                    <TableCell className="text-xs text-zinc-400">
                      {formatScheduledDate(wo.scheduled_at)}
                    </TableCell>

                    {/* Fecha de creación - solo admins */}
                    {canSeeAdminColumns && (
                      <TableCell className="text-xs text-zinc-400">
                        {formatScheduledDate(wo.created_at)}
                      </TableCell>
                    )}

                    {/* Asignada - solo admins (TACTICAL HUD: Team > Technician) */}
                    {canSeeAdminColumns && (
                      <TableCell className="text-sm">
                        {wo.team_name ? (
                          <div className="flex items-center gap-1.5 text-cyan-400">
                            <Users size={14} className="flex-shrink-0" />
                            <span className="font-medium">{wo.team_name}</span>
                          </div>
                        ) : wo.technician_name ? (
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <User size={14} className="flex-shrink-0 text-zinc-500" />
                            <span>{wo.technician_name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">Sin asignar</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
