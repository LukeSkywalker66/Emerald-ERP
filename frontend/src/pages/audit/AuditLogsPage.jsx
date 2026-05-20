import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  X,
  Package,
  Activity,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DatePickerPopover from '@/components/ui/DatePickerPopover';
import api from '@/api/client';

/**
 * AuditLogsPage - Monitor de auditoría universal
 * Vista SOLO para admins que muestra todos los cambios en el sistema
 *
 * Filtros mejorados:
 * - Rango de fechas (Desde / Hasta)
 * - Dropdown de módulo (populado desde backend)
 * - Dropdown de acción (populado desde backend)
 * - Filtro por ID de usuario
 */
export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Opciones para dropdowns (populadas desde backend)
  const [entityNames, setEntityNames] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);

  // Filtros
  const [filters, setFilters] = useState({
    entity_name: '',
    action: '',
    user_id: '',
    date_from: '',
    date_to: '',
  });

  // Paginación
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0,
  });

  // Cargar opciones de dropdowns al montar el componente
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [entityRes, actionRes] = await Promise.all([
          api.get('/v2/audit-logs/entity-names'),
          api.get('/v2/audit-logs/actions'),
        ]);
        setEntityNames(entityRes.data || []);
        setActionTypes(actionRes.data || []);
      } catch (err) {
        console.error('❌ Error al cargar opciones de filtros:', err);
        // No bloquear la carga principal si fallan los auxiliares
      }
    };
    loadOptions();
  }, []);

  // Recargar cuando cambien los filtros o la paginación
  useEffect(() => {
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, filters]);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        offset: pagination.offset,
        limit: pagination.limit,
      });

      // Agregar filtros si están activos
      if (filters.entity_name) params.append('entity_name', filters.entity_name);
      if (filters.action) params.append('action', filters.action);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/v2/audit-logs?${params}`);
      setLogs(response.data.items || []);
      setPagination((prev) => ({ ...prev, total: response.data.total || 0 }));
    } catch (error) {
      console.error('❌ Error al cargar audit logs:', error);
      setError('Error al cargar registros de auditoría');
    } finally {
      setLoading(false);
    }
  }, [pagination.offset, pagination.limit, filters]);

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const handleResetFilters = () => {
    setFilters({ entity_name: '', action: '', user_id: '', date_from: '', date_to: '' });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    }
  };

  // Contar filtros activos
  const activeFilterCount = [
    filters.entity_name,
    filters.action,
    filters.user_id,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'UPDATE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'LOGIN': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'LOGOUT': return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
      case 'ACCESS_DENIED': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Auditoría Universal</h1>
            <p className="text-sm text-zinc-400">
              Monitor de cambios en el sistema • Solo Admin
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Filter className="w-5 h-5" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 ml-2">
                  {activeFilterCount} activo{activeFilterCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
          <CardDescription className="text-zinc-400">
            Buscar registros por fecha, módulo, acción o usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Fecha Desde */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Desde</label>
              <DatePickerPopover
                value={filters.date_from}
                onChange={(value) => {
                  setFilters({ ...filters, date_from: value });
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                placeholder="Seleccionar fecha inicial"
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Hasta</label>
              <DatePickerPopover
                value={filters.date_to}
                onChange={(value) => {
                  setFilters({ ...filters, date_to: value });
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                placeholder="Seleccionar fecha final"
              />
            </div>

            {/* Módulo (Entity Name) */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                Módulo
              </label>
              <Select
                value={filters.entity_name || 'all'}
                onValueChange={(value) => {
                  setFilters({ ...filters, entity_name: value === 'all' ? '' : value });
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Todos los módulos" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  <SelectItem value="all">Todos los módulos</SelectItem>
                  {entityNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Acción */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                Acción
              </label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(value) => {
                  setFilters({ ...filters, action: value === 'all' ? '' : value });
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User ID */}
            <div className="lg:col-span-4 md:col-span-2">
              <label className="text-sm text-zinc-400 mb-2 block">ID de Usuario</label>
              <Input
                placeholder="ej: 5"
                type="number"
                value={filters.user_id}
                onChange={(e) => {
                  setFilters({ ...filters, user_id: e.target.value });
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Audit Logs */}
      <Card className="flex-1 bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            Registros de Auditoría
            <span className="ml-2 text-sm font-normal text-zinc-400">
              ({pagination.total} total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-zinc-400">Cargando registros...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-500">
              <FileText className="w-8 h-8 mr-2" />
              No hay registros de auditoría
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-850">
                  <TableHead className="text-zinc-400">Fecha/Hora</TableHead>
                  <TableHead className="text-zinc-400">Usuario</TableHead>
                  <TableHead className="text-zinc-400">Acción</TableHead>
                  <TableHead className="text-zinc-400">Entidad</TableHead>
                  <TableHead className="text-zinc-400">ID</TableHead>
                  <TableHead className="text-zinc-400">Estado</TableHead>
                  <TableHead className="text-zinc-400">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-zinc-800 hover:bg-zinc-850/50"
                  >
                    <TableCell className="text-zinc-300 font-mono text-xs">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {log.user_name || `Usuario #${log.user_id}`}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getActionColor(log.action)} font-mono`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-300 font-mono text-sm">
                      {log.entity_name}
                    </TableCell>
                    <TableCell className="text-zinc-400 font-mono">
                      {log.entity_id || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          Success
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                          Failure
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Paginación */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          <div className="text-sm text-zinc-400">
            Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={pagination.offset === 0}
              className="border-zinc-700 text-zinc-300 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="border-zinc-700 text-zinc-300 disabled:opacity-30"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Detalles */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-emerald-400">
              Detalles de Auditoría
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500">Usuario:</span>
                  <p className="text-zinc-100 font-medium">
                    {selectedLog.user_name || `Usuario #${selectedLog.user_id}`}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Fecha:</span>
                  <p className="text-zinc-100 font-mono">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Acción:</span>
                  <Badge className={`${getActionColor(selectedLog.action)} font-mono mt-1`}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <span className="text-zinc-500">Entidad:</span>
                  <p className="text-zinc-100 font-mono">
                    {selectedLog.entity_name} #{selectedLog.entity_id}
                  </p>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <span className="text-zinc-500">IP:</span>
                    <p className="text-zinc-400 font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {/* Valores Anteriores (old_values) */}
              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div>
                  <h3 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                    Valores Anteriores
                  </h3>
                  <pre className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 overflow-auto text-xs font-mono text-amber-300">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {/* Valores Nuevos (new_values) */}
              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div>
                  <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                    Valores Nuevos
                  </h3>
                  <pre className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 overflow-auto text-xs font-mono text-emerald-300">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Message (si existe) */}
              {selectedLog.error_message && (
                <div>
                  <h3 className="text-red-400 font-semibold mb-2">Error</h3>
                  <p className="bg-red-500/10 p-4 rounded-lg border border-red-500/30 text-red-300">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
