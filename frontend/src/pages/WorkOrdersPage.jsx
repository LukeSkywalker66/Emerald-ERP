import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  RefreshCw,
  Search,
  ExternalLink,
  Wrench,
  Package,
  Cable,
  RadioTower,
  Zap,
  Users,
  User,
  Lock,
  ShieldAlert,
  Truck,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/utils/permissions';
import usePersistedViewState from '@/hooks/usePersistedViewState';
import workOrdersService from '@/services/workOrders.service';
import coordinationService from '@/services/coordination.service';
import fleetService from '@/services/fleet.service';
import workOrderTypesService from '@/services/workOrderTypes.service';
import { getAllSettings, settingsToMap } from '@/services/settings.service';
import { getShiftForDate } from '@/utils/workHours';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CloseWorkOrderDialog from '@/components/work-orders/CloseWorkOrderDialog';
import PendingWorkOrderUpdates from '@/components/work-orders/PendingWorkOrderUpdates';
import VehicleInspectionDialog from '@/components/fleet/VehicleInspectionDialog';
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
  coordinated: {
    label: 'Coordinada',
    variant: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  },
  scheduled: {
    label: 'Programada',
    variant: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
  },
  assigned: {
    label: 'Asignada',
    variant: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  },
  in_progress: { 
    label: 'En curso', 
    variant: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  },
  pending_closure: {
    label: 'Pendiente Cierre',
    variant: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
  completed: { 
    label: 'Completada', 
    variant: 'bg-zinc-700/40 border-zinc-600 text-zinc-300',
  },
  failed: {
    label: 'Fallida',
    variant: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
  cancelled: {
    label: 'Cancelada',
    variant: 'bg-zinc-700/40 border-zinc-600 text-zinc-400',
  },
};

// Config: Tipos de OT
const TYPE_CONFIG = {
  repair: { label: 'Soporte', icon: Wrench, color: 'text-emerald-400' },
  install_ftth: { label: 'Instalación FTTH', icon: Cable, color: 'text-blue-400' },
  install_aire: { label: 'Instalación Aire', icon: RadioTower, color: 'text-sky-400' },
  pickup: { label: 'Retiro', icon: Package, color: 'text-amber-400' },
  infrastructure: { label: 'Infraestructura', icon: Zap, color: 'text-purple-400' },
};

// ============================================================
// Helpers de agrupación de agenda (día + turno + sin planificar)
// ============================================================
function getDayKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// El cálculo de turno (Mañana/Tarde) usa el horario vigente por fecha
// y se resuelve vía getShiftForDate() de utils/workHours.

function formatDayLabel(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  const prefix =
    diffDays === 0 ? 'Hoy · ' : diffDays === 1 ? 'Mañana · ' : diffDays === -1 ? 'Ayer · ' : '';
  const label = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return `${prefix}${label}`;
}

// Vista por defecto de la grilla de OTs (persistida por usuario).
const WORK_ORDERS_GRID_DEFAULTS = {
  search: '',
  status: '',
  type: '',
  team: '',
  sortKey: 'date',
  sortDir: 'desc',
  pageSize: 50,
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);

  // Roles que ven columnas adicionales (Programada, Creada, Asignada)
  const canSeeAdminColumns = useMemo(
    () => ['admin', 'coordinator', 'operator', 'tecnico_encargado'].includes(role),
    [role]
  );

  // Roles que pueden filtrar por cuadrilla (admin, operator y técnico encargado)
  const canFilterByTeam = useMemo(
    () => ['admin', 'operator', 'tecnico_encargado'].includes(role),
    [role]
  );

  // Detectar si es técnico (para bifurcación de fetch)
  const isTechnician = useMemo(() => role === 'tecnico', [role]);

  // Team info for technician view
  const [teamInfo, setTeamInfo] = useState(null);
  const [teamVehicle, setTeamVehicle] = useState(null);

  // State
  // Lista completa (sin filtrar) cargada desde el backend. Los filtros se aplican
  // de forma derivada (useMemo) para no refetchear en cada cambio de filtro.
  const [allWorkOrders, setAllWorkOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  // Guard contra respuestas "viejas" (evita que una fetch sin filtros pise a una filtrada).
  const loadRequestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [teams, setTeams] = useState([]); // Lista de cuadrillas disponibles
  const [pendingClosureOrders, setPendingClosureOrders] = useState([]);
  const [selectedPendingClosure, setSelectedPendingClosure] = useState(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [isOpeningCloseDialog, setIsOpeningCloseDialog] = useState(false);
  const [needsInspection, setNeedsInspection] = useState(false);
  const [assignedVehicleId, setAssignedVehicleId] = useState(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);

  // OT Types (DB-driven)
  const [otTypes, setOtTypes] = useState([]);

  // Horario de visitas técnicas (con vigencia por fecha) para agrupar turnos
  const [workHoursRaw, setWorkHoursRaw] = useState(null);

  // Vista persistida por usuario (filtros + orden).
  const [view, setView, hydrated] = usePersistedViewState('work_orders.grid', WORK_ORDERS_GRID_DEFAULTS);
  const searchQuery = view.search;
  const statusFilter = view.status;
  const typeFilter = view.type;
  const teamFilter = view.team;
  const sortKey = view.sortKey;
  const sortDir = view.sortDir;
  const pageSize = view.pageSize;

  // Setters que escriben en la vista persistida (soportan updater funcional).
  const applyViewUpdate = (key) => (updater) =>
    setView((prev) => ({
      ...prev,
      [key]: typeof updater === 'function' ? updater(prev[key]) : updater,
    }));
  const setSearchQuery = applyViewUpdate('search');
  const setStatusFilter = applyViewUpdate('status');
  const setTypeFilter = applyViewUpdate('type');
  const setTeamFilter = applyViewUpdate('team');
  const setSortKey = applyViewUpdate('sortKey');
  const setSortDir = applyViewUpdate('sortDir');
  const setPageSize = (v) => {
    setView((prev) => ({ ...prev, pageSize: v }));
    setCurrentPage(1);
  };

  // Load data — listado único paginado para técnicos y admin/coordinador.
  const loadWorkOrders = async () => {
    const requestId = ++loadRequestIdRef.current;
    const isStale = () => requestId !== loadRequestIdRef.current;
    try {
      setError(null);

      // Filtros server-side (comunes a todos los roles).
      const offset = (currentPage - 1) * pageSize;
      const params = {
        limit: pageSize,
        offset,
        order_by: 'created_at',
        order_dir: 'desc',
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.ot_type = typeFilter;
      if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();
      if (teamFilter === 'unassigned') {
        params.unassigned = true;
      } else if (teamFilter === 'assigned') {
        params.assigned = true;
      } else if (teamFilter) {
        params.team_id = Number(teamFilter);
      }

      const data = await workOrdersService.listWorkOrders(params);
      if (isStale()) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setAllWorkOrders(items);
      setTotalCount(Number(data?.total ?? 0));

      if (!isTechnician) {
        setPendingClosureOrders([]);
        setNeedsInspection(false);
        setAssignedVehicleId(null);
        setTeamInfo(null);
        setTeamVehicle(null);
        return;
      }

      // ========== TÉCNICOS: pending closure + inspección (independientes del listado) ==========
      const pendingClosureData = await workOrdersService.getMyPendingClosure();
      if (isStale()) return;
      setPendingClosureOrders(Array.isArray(pendingClosureData) ? pendingClosureData : []);

      // ========== HARD BLOCK: Inspección diaria de vehículo ==========
      // Si el técnico trabaja a pie (sin vehículo), NO se bloquea.
      try {
        if (!user?.id) {
          setAssignedVehicleId(null);
          setNeedsInspection(false);
          setTeamInfo(null);
          setTeamVehicle(null);
          return;
        }

        const teams = await coordinationService.getUserTeams(user?.id);
        const primaryTeam = (teams || [])[0];
        const teamWithVehicle = (teams || []).find((team) => !!team.vehicle_id);

        // Fetch team details (members, vehicle)
        if (primaryTeam) {
          try {
            const detail = await coordinationService.getTeamDetail(primaryTeam.id);
            setTeamInfo(detail);
          } catch {
            setTeamInfo(primaryTeam);
          }
        } else {
          setTeamInfo(null);
        }

        if (teamWithVehicle?.vehicle_id) {
          const vehicleId = teamWithVehicle.vehicle_id;
          setAssignedVehicleId(vehicleId);
          // Fetch vehicle details
          try {
            const vehicle = await fleetService.getVehicleDetail(vehicleId);
            setTeamVehicle(vehicle);
          } catch {
            setTeamVehicle(null);
          }

          try {
            await fleetService.checkTodayInspection(vehicleId);
            setNeedsInspection(false);
          } catch (inspectionErr) {
            if (inspectionErr?.response?.status === 404) {
              setNeedsInspection(true);
            } else {
              setNeedsInspection(false);
            }
          }
        } else {
          setAssignedVehicleId(null);
          setNeedsInspection(false);
          setTeamVehicle(null);
        }
      } catch (teamsErr) {
        setAssignedVehicleId(null);
        setNeedsInspection(false);
        setTeamInfo(null);
        setTeamVehicle(null);
      }
    } catch (err) {
      if (isStale()) return;
      setError(err?.response?.data?.detail || err.message || 'Error al cargar OTs');
      console.error('Error loading work orders:', err);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // El listado ya viene filtrado y paginado server-side para TODOS los roles
  // (técnicos y admin/coordinador). Acá solo exponemos la referencia.
  const workOrders = useMemo(() => allWorkOrders, [allWorkOrders]);

  // Cargar tipos de OT y cuadrillas desde la DB
  useEffect(() => {
    workOrderTypesService.getWorkOrderTypes(false).then(setOtTypes).catch(() => {});
    coordinationService
      .getTeams({ active_only: true })
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Cargar horario de visitas técnicas (con vigencia por fecha)
  useEffect(() => {
    getAllSettings()
      .then((settings) => {
        const map = settingsToMap(settings);
        if (map.work_hours) {
          setWorkHoursRaw(map.work_hours);
        }
      })
      .catch(() => {});
  }, []);

  // Debounce de búsqueda (evita refetch en cada tecla).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!hydrated) return;
    setIsLoading(true);
    loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isTechnician, user?.id, currentPage, pageSize, debouncedSearchQuery, statusFilter, typeFilter, teamFilter]);

  // Al cambiar un filtro, volver a la primera página.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, typeFilter, teamFilter]);

  // Formatear fecha
  const formatScheduledDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    // toLocaleString (no toLocaleDateString) para incluir hora y minutos
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Ordenamiento por encabezado: primer click ordena asc, segundo click alterna a desc.
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Agrupación visual de la agenda: sin planificar + por día + por turno (mañana/tarde)
  const groupedWorkOrders = useMemo(() => {
    const sorted = [...workOrders].sort((a, b) => {
      const ad = a.scheduled_start || a.scheduled_at;
      const bd = b.scheduled_start || b.scheduled_at;
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return new Date(bd).getTime() - new Date(ad).getTime();
    });

    const groups = [];
    const indexByKey = new Map();

    for (const wo of sorted) {
      const rawDate = wo.scheduled_start || wo.scheduled_at;
      const dayKey = getDayKey(rawDate);

      if (!dayKey) {
        let g = groups.find((x) => x.type === 'unscheduled');
        if (!g) {
          g = { type: 'unscheduled', dayKey: null, label: 'Sin planificar', shift: null, items: [] };
          groups.push(g);
        }
        g.items.push(wo);
        continue;
      }

      const shift = getShiftForDate(workHoursRaw, rawDate) || 'Mañana';
      const key = `${dayKey}::${shift}`;
      let g = indexByKey.get(key);
      if (!g) {
        g = { type: 'scheduled', dayKey, label: formatDayLabel(dayKey), shift, items: [] };
        indexByKey.set(key, g);
        groups.push(g);
      }
      g.items.push(wo);
    }

    // Ordenar items dentro de cada grupo según el criterio elegido y su dirección
    const dir = sortDir === 'desc' ? -1 : 1;
    const compare = (a, b) => {
      if (sortKey === 'client') {
        return dir * String(a.client_name || '').localeCompare(String(b.client_name || ''));
      }
      if (sortKey === 'address') {
        return dir * String(a.address || '').localeCompare(String(b.address || ''));
      }
      if (sortKey === 'id') {
        return dir * (a.id - b.id);
      }
      // 'date'
      const ad = new Date(a.scheduled_start || a.scheduled_at || 0).getTime();
      const bd = new Date(b.scheduled_start || b.scheduled_at || 0).getTime();
      return dir * (ad - bd);
    };
    for (const g of groups) {
      g.items.sort(compare);
    }

    return groups;
  }, [workOrders, sortKey, sortDir, workHoursRaw]);

  const hasPendingClosureBlock = isTechnician && pendingClosureOrders.length > 0;
  const hasInspectionBlock = isTechnician && needsInspection;

  const openPendingClosureDialog = async (workOrderId) => {
    try {
      setIsOpeningCloseDialog(true);
      const detail = await workOrdersService.getWorkOrderDetail(workOrderId);
      setSelectedPendingClosure(detail);
      setShowCloseDialog(true);
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Error al abrir el cierre de OT';
      alert(detail);
    } finally {
      setIsOpeningCloseDialog(false);
    }
  };

  const handlePendingClosureCompleted = async () => {
    setShowCloseDialog(false);
    setSelectedPendingClosure(null);
    setIsRefreshing(true);
    await loadWorkOrders();
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

        <div className="flex items-center gap-2">
          {canSeeAdminColumns && <PendingWorkOrderUpdates />}
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
      </div>

      {/* Team Info Card - Solo para técnicos */}
      {isTechnician && teamInfo && (
        <div className="rounded-xl border border-emerald-800/60 bg-gradient-to-r from-emerald-950/70 to-zinc-950 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">{teamInfo.name}</span>
          </div>
          {teamVehicle && (
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-cyan-400" />
              <span className="text-sm text-zinc-200">{teamVehicle.name}</span>
              {teamVehicle.license_plate && (
                <span className="text-xs text-zinc-500">({teamVehicle.license_plate})</span>
              )}
            </div>
          )}
          {teamInfo.members && teamInfo.members.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <User size={16} className="text-zinc-400" />
              {teamInfo.members
                .filter((m) => m.user_id !== user?.id)
                .map((m, i) => (
                  <span key={m.user_id} className="text-xs text-zinc-300">
                    {m.user_name}{m.role === 'leader' ? ' (Líder)' : ''}{i < teamInfo.members.filter(x => x.user_id !== user?.id).length - 1 ? ',' : ''}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

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

      {/* PRISIÓN DEL TÉCNICO: bloqueo de agenda */}
      {hasPendingClosureBlock && (
        <div className="rounded-xl border border-rose-700/60 bg-gradient-to-r from-rose-950/70 to-zinc-950 p-4 space-y-3 shadow-lg shadow-rose-900/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-700/50">
              <ShieldAlert size={18} className="text-rose-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={14} className="text-rose-300" />
                <p className="text-sm font-semibold text-rose-100">🔒 Agenda Bloqueada</p>
                <Badge className="bg-rose-700/30 border border-rose-600 text-rose-200">
                  {pendingClosureOrders.length} vencida{pendingClosureOrders.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-xs text-rose-200/90">
                Tu agenda está bloqueada. Debes cerrar estas OTs vencidas con notas y fotos antes de ejecutar nuevas asignaciones.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {pendingClosureOrders.map((wo) => (
              <div
                key={wo.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/app/work-orders/${wo.id}/execute`, {
                    state: { blockNewTasks: true },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/app/work-orders/${wo.id}/execute`, {
                      state: { blockNewTasks: true },
                    });
                  }
                }}
                className="w-full text-left rounded-lg border border-rose-800/60 bg-zinc-900/70 px-3 py-2 hover:bg-zinc-800/80 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-100">OT #{wo.id} · {wo.client_name || 'Sin cliente'}</p>
                    <p className="text-xs text-zinc-300 truncate">{wo.address || 'Sin dirección'} · Programada: {formatScheduledDate(wo.scheduled_start || wo.scheduled_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                      Ver detalles
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPendingClosureDialog(wo.id);
                      }}
                      disabled={isOpeningCloseDialog}
                      className="rounded-lg border border-rose-600 text-rose-300 px-2 py-1 text-xs hover:bg-rose-950/30 disabled:opacity-60"
                    >
                      Cerrar ahora
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HARD BLOCK: Inspección diaria de vehículo */}
      {hasInspectionBlock && (
        <div className="rounded-xl border border-amber-700/60 bg-gradient-to-r from-amber-950/70 to-zinc-950 p-4 space-y-3 shadow-lg shadow-amber-900/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-900/60 border border-amber-700/50">
              <ShieldAlert size={18} className="text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={14} className="text-amber-300" />
                <p className="text-sm font-semibold text-amber-100">🚐 Control de Vehículo Pendiente</p>
                <Badge className="bg-amber-700/30 border border-amber-600 text-amber-200">
                  Bloqueo operativo
                </Badge>
              </div>
              <p className="text-xs text-amber-200/90">
                Antes de ver y ejecutar tus Órdenes de Trabajo, debés completar la planilla diaria de control previo a la salida del vehículo.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setInspectionDialogOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!assignedVehicleId}
            >
              Completar Inspección
            </Button>
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
              placeholder="Buscar por ID o asunto..."
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
            <option value="coordinated">Coordinada</option>
            <option value="scheduled">Programada</option>
            <option value="assigned">Asignada</option>
            <option value="in_progress">En curso</option>
            <option value="pending_closure">Pendiente Cierre</option>
            <option value="completed">Completada</option>
            <option value="failed">Fallida</option>
            <option value="cancelled">Cancelada</option>
          </select>

          {/* Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/40 h-9"
          >
            <option value="">Todos los tipos</option>
            {otTypes.filter(t => t.is_active).map((type) => (
              <option key={type.id} value={type.code}>{type.name}</option>
            ))}
          </select>

          {/* Filtro por cuadrilla (solo admin y operator) */}
          {canFilterByTeam && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/40 h-9"
            >
              <option value="">Todas las cuadrillas</option>
              <option value="unassigned">Sin asignar</option>
              <option value="assigned">Asignada</option>
              {teams.length > 0 && <option disabled>─────────────</option>}
              {teams.map((team) => (
                <option key={team.id} value={String(team.id)}>
                  {team.name}
                </option>
              ))}
            </select>
          )}

        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800 gap-3 flex-wrap">
          <span>
            {isTechnician
              ? `${workOrders.length} órdenes`
              : `Mostrando ${totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCount)} de ${totalCount} órdenes`}
          </span>

          {!isTechnician && (
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white disabled:opacity-30"
              >
                Anterior
              </button>
              <span>
                Página {currentPage} de {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          )}

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
                <TableHead className="w-[70px] text-zinc-400 font-semibold">
                  <button type="button" onClick={() => handleSort('id')} className="flex items-center gap-1 hover:text-emerald-300 transition-colors">
                    ID
                    {sortKey === 'id' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </TableHead>
                <TableHead className="w-[60px] text-zinc-400 font-semibold">Tipo</TableHead>
                <TableHead className="w-[120px] text-zinc-400 font-semibold">Estado</TableHead>
                <TableHead className="text-zinc-400 font-semibold">
                  <button type="button" onClick={() => handleSort('client')} className="flex items-center gap-1 hover:text-emerald-300 transition-colors">
                    Cliente
                    {sortKey === 'client' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </TableHead>
                <TableHead className="text-zinc-400 font-semibold">
                  <button type="button" onClick={() => handleSort('address')} className="flex items-center gap-1 hover:text-emerald-300 transition-colors">
                    Dirección
                    {sortKey === 'address' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </TableHead>
                <TableHead className="w-[140px] text-zinc-400 font-semibold">
                  <button type="button" onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-emerald-300 transition-colors">
                    Programada
                    {sortKey === 'date' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </TableHead>
                {canSeeAdminColumns && (
                  <TableHead className="w-[130px] text-zinc-400 font-semibold">Creada</TableHead>
                )}
                {canSeeAdminColumns && (
                  <TableHead className="w-[140px] text-zinc-400 font-semibold">Asignada</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {groupedWorkOrders.map((group) => (
                <React.Fragment
                  key={group.type === 'unscheduled' ? 'unscheduled' : `${group.dayKey}-${group.shift}`}
                >
                  <TableRow
                    className={`border-b ${
                      group.type === 'unscheduled'
                        ? 'bg-amber-950/30 border-amber-900/40'
                        : 'bg-emerald-950/30 border-emerald-900/40'
                    } hover:bg-transparent`}
                  >
                    <TableCell colSpan={canSeeAdminColumns ? 8 : 6} className="py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            group.type === 'unscheduled' ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          {group.label}
                        </span>
                        {group.shift && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              group.shift === 'Mañana'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                : 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                            }`}
                          >
                            {group.shift}
                          </Badge>
                        )}
                        <span className="text-xs text-zinc-400">({group.items.length})</span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {group.items.map((wo) => {
                    const typeConfig = TYPE_CONFIG[wo.ot_type] || TYPE_CONFIG.repair;
                const TypeIcon = typeConfig.icon;
                const statusConfig = STATUS_CONFIG[wo.status] || {
                  label: wo.status || 'Desconocido',
                  variant: 'bg-zinc-700/40 border-zinc-600 text-zinc-300',
                };

                return (
                  <TableRow
                    key={wo.id}
                    onClick={() => {
                      navigate(`/app/work-orders/${wo.id}/execute`, {
                        state: {
                          needsInspection: hasInspectionBlock,
                          inspectionMessage: hasInspectionBlock
                            ? 'Complete la inspección del vehículo primero'
                            : null,
                          blockNewTasks: hasPendingClosureBlock,
                        },
                      });
                    }}
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
                      {formatScheduledDate(wo.scheduled_start || wo.scheduled_at)}
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
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Wizard de cierre desde Prisión del Técnico */}
      <CloseWorkOrderDialog
        workOrder={selectedPendingClosure}
        isOpen={showCloseDialog && !!selectedPendingClosure}
        onClose={() => {
          setShowCloseDialog(false);
          setSelectedPendingClosure(null);
        }}
        onComplete={handlePendingClosureCompleted}
        onMaterialsUpdated={async () => {
          if (!selectedPendingClosure?.id) return;
          const refreshed = await workOrdersService.getWorkOrderDetail(selectedPendingClosure.id);
          setSelectedPendingClosure(refreshed);
        }}
      />

      <VehicleInspectionDialog
        open={inspectionDialogOpen}
        onOpenChange={setInspectionDialogOpen}
        vehicleId={assignedVehicleId}
        onSubmitted={async () => {
          setIsRefreshing(true);
          await loadWorkOrders();
        }}
      />
    </div>
  );
}
