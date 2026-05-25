/**
 * ScheduledTasksTab.jsx
 * Gestión completa de Tareas Programadas (Scheduled Tasks V2)
 * 
 * Características:
 * - Listado con filtro por categoría
 * - Edición inline: cron expression, activo/inactivo, max ejecuciones
 * - Ejecución forzada (trigger)
 * - Historial de ejecuciones por tarea
 * - Toggle para mostrar/ocultar tareas de sistema
 * - Sincronización desde Celery Beat
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock,
  CalendarDays,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Settings2,
  Terminal,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getScheduledTasks,
  updateScheduledTask,
  triggerScheduledTask,
  getScheduledTaskLogs,
  syncScheduledTasks,
} from '@/services/settings.service';
import ScheduleConfigurator from '@/components/settings/ScheduleConfigurator';

// ─── Helpers ────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  sync: 'Sincronización',
  maintenance: 'Mantenimiento',
  api_keys: 'API Keys',
  general: 'General',
};

const CATEGORY_COLORS = {
  sync: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  maintenance: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  api_keys: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  general: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status) {
  switch (status) {
    case 'success':
      return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Éxito' };
    case 'failed':
      return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Fallo' };
    case 'running':
      return { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Ejecutando' };
    default:
      return { icon: HelpCircle, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: status || '—' };
  }
}

/**
 * Convierte expresión cron a descripción legible en español.
 * Refleja la lógica de backend/src/utils/schedule_parser.py.
 */
function cronToHumanReadable(cron) {
  if (!cron) return 'No configurado';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return `Cron: ${cron}`;

  const [minute, hour, dom, month, dow] = parts;

  // Cada N minutos
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Cada ${minute.slice(2)} minutos`;
  }

  // Cada N horas
  if (minute === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const val = hour.slice(2);
    return `Cada ${val} hora${val !== '1' ? 's' : ''}`;
  }

  // Diario
  if (dom === '*' && month === '*' && dow === '*') {
    if (hour.includes(',')) {
      const times = hour.split(',').map((h) => {
        const hh = parseInt(h, 10);
        const suffix = hh < 12 ? 'AM' : 'PM';
        const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${h12}:${minute.padStart(2, '0')} ${suffix}`;
      }).join(', ');
      return `Diario a las ${times}`;
    }
    const hh = parseInt(hour, 10);
    const suffix = hh < 12 ? 'AM' : 'PM';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `Diario a las ${h12}:${minute.padStart(2, '0')} ${suffix}`;
  }

  // Semanal
  if (dom === '*' && month === '*' && dow !== '*') {
    const DAY_LABELS = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
    const dayNames = dow.split(',').map((d) => DAY_LABELS[parseInt(d, 10)] || d).join(', ');
    const hh = parseInt(hour, 10);
    const suffix = hh < 12 ? 'AM' : 'PM';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${dayNames} a las ${h12}:${minute.padStart(2, '0')} ${suffix}`;
  }

  return `Cron: ${cron}`;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ScheduledTasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // task id being saved
  const [triggering, setTriggering] = useState(null); // task id being triggered
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showSystem, setShowSystem] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [logsMap, setLogsMap] = useState({}); // { taskId: { items, total, loading } }
  const [expandedLogs, setExpandedLogs] = useState({}); // { taskId: true/false }

  // Edit form state
  const [editForm, setEditForm] = useState({
    schedule_config: null,
    cron_expression: '',
    is_active: true,
    max_executions: '',
  });

  // ── Load data ──────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getScheduledTasks({
        include_system: showSystem,
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      });
      setTasks(data || []);
    } catch (err) {
      console.error('❌ Error loading scheduled tasks:', err);
      setError('No se pudieron cargar las tareas programadas.');
    } finally {
      setLoading(false);
    }
  }, [showSystem, categoryFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Selection ──────────────────────────────────────────────────────

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const selectTask = (task) => {
    setSelectedTaskId(task.id);
    setEditForm({
      schedule_config: task.schedule_config || null,
      cron_expression: task.cron_expression || '',
      is_active: task.is_active,
      max_executions: task.max_executions != null ? String(task.max_executions) : '',
    });
  };

  // ── Save configuration ─────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedTask) return;

    setSaving(selectedTask.id);
    setFeedback(null);

    try {
      const payload = {};

      // Si hay schedule_config, enviarlo (el backend computa cron automáticamente)
      const currentConfig = selectedTask.schedule_config || null;
      const newConfig = editForm.schedule_config || null;
      if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
        payload.schedule_config = newConfig;
      } else if (editForm.cron_expression !== (selectedTask.cron_expression || '')) {
        payload.cron_expression = editForm.cron_expression || null;
      }

      if (editForm.is_active !== selectedTask.is_active) {
        payload.is_active = editForm.is_active;
      }
      const parsedMax = editForm.max_executions === ''
        ? -1  // sentinel: no cambiar
        : parseInt(editForm.max_executions, 10);
      const currentMax = selectedTask.max_executions;
      if (parsedMax !== -1 && parsedMax !== currentMax) {
        payload.max_executions = parsedMax;
      } else if (parsedMax === -1 && currentMax != null) {
        // User cleared the field → set to null (unlimited)
        payload.max_executions = null;
      }

      // Only call API if something changed
      if (Object.keys(payload).length === 0) {
        setFeedback({ type: 'info', message: 'No hay cambios para guardar.' });
        return;
      }

      await updateScheduledTask(selectedTask.id, payload);
      setFeedback({ type: 'success', message: 'Configuración guardada correctamente.' });
      await loadTasks();
      // Re-select the task to get fresh data
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) selectTask(updated);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setFeedback({ type: 'error', message: `Error al guardar: ${detail}` });
    } finally {
      setSaving(null);
    }
  };

  // ── Trigger execution ─────────────────────────────────────────────

  const handleTrigger = async (taskId) => {
    setTriggering(taskId);
    setFeedback(null);

    try {
      const result = await triggerScheduledTask(taskId);
      setFeedback({
        type: result.success ? 'success' : 'error',
        message: result.message || 'Tarea ejecutada.',
      });
      // Refresh logs after a delay
      setTimeout(() => {
        if (selectedTaskId === taskId) {
          loadLogs(taskId);
        }
        loadTasks();
      }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setFeedback({ type: 'error', message: `Error: ${detail}` });
    } finally {
      setTriggering(null);
    }
  };

  // ── Sync from Beat ────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const result = await syncScheduledTasks();
      setFeedback({ type: 'success', message: result.message || 'Sincronización completada.' });
      await loadTasks();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setFeedback({ type: 'error', message: `Error de sincronización: ${detail}` });
    } finally {
      setSyncing(false);
    }
  };

  // ── Logs ──────────────────────────────────────────────────────────

  const loadLogs = async (taskId) => {
    setLogsMap((prev) => ({ ...prev, [taskId]: { ...prev[taskId], loading: true } }));
    try {
      const data = await getScheduledTaskLogs(taskId, { limit: 20 });
      setLogsMap((prev) => ({
        ...prev,
        [taskId]: { items: data.items || [], total: data.total || 0, loading: false },
      }));
    } catch (err) {
      console.error('❌ Error loading task logs:', err);
      setLogsMap((prev) => ({
        ...prev,
        [taskId]: { items: [], total: 0, loading: false },
      }));
    }
  };

  const toggleLogs = (taskId) => {
    const willExpand = !expandedLogs[taskId];
    setExpandedLogs((prev) => ({ ...prev, [taskId]: willExpand }));
    if (willExpand && !logsMap[taskId]) {
      loadLogs(taskId);
    }
  };

  // ── Filtered tasks ────────────────────────────────────────────────

  const filteredTasks = tasks.filter((t) => {
    if (!showSystem && t.is_system_task) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SlidersHorizontal size={14} className="mr-1 text-zinc-500" />
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="sync">Sincronización</SelectItem>
              <SelectItem value="maintenance">Mantenimiento</SelectItem>
              <SelectItem value="api_keys">API Keys</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          {/* Show system tasks toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSystem(!showSystem)}
            className={`h-9 text-xs gap-1.5 ${showSystem ? 'text-purple-400' : 'text-zinc-500'}`}
          >
            {showSystem ? <Eye size={14} /> : <EyeOff size={14} />}
            {showSystem ? 'Mostrando sistema' : 'Tareas sistema'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTasks}
            disabled={loading}
            className="h-9"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* ── Feedback ────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : feedback.type === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            : feedback.type === 'error'
              ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              : <Clock size={16} className="mt-0.5 flex-shrink-0" />
          }
          <p className="text-xs">{feedback.message}</p>
        </div>
      )}

      {/* ── Main content: Task list + Edit panel ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Task list (3/5) ──────────────────────────────────────────── */}
        <div className="xl:col-span-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              <CalendarClock size={14} className="text-emerald-400" />
              Tareas Programadas
              {!loading && <span className="text-xs text-zinc-500 font-normal">({filteredTasks.length})</span>}
            </h3>
          </div>

          {error ? (
            <div className="flex flex-col items-center py-12 text-center">
              <XCircle size={32} className="text-red-400 mb-3" />
              <p className="text-sm text-zinc-300 mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={loadTasks}>Reintentar</Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <CalendarClock size={32} className="mx-auto text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500">No hay tareas programadas.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
              {filteredTasks.map((task) => {
                const catColor = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general;
                const isSelected = selectedTaskId === task.id;
                const sb = statusBadge(task.last_execution_status);

                return (
                  <div
                    key={task.id}
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-800/30 ${
                      isSelected ? 'bg-zinc-800/40 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'
                    }`}
                    onClick={() => selectTask(task)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {task.display_name}
                          </span>
                          <Badge className={`${catColor} text-[10px] px-1.5 py-0`}>
                            {CATEGORY_LABELS[task.category] || task.category}
                          </Badge>
                          {task.is_system_task && (
                            <Badge className="text-purple-400 bg-purple-500/10 border-purple-500/30 text-[10px] px-1.5 py-0">
                              Sistema
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mb-1.5 line-clamp-1">
                          {task.description || 'Sin descripción'}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1" title={task.cron_expression || ''}>
                            <CalendarDays size={11} />
                            {task.schedule_config
                              ? cronToHumanReadable(task.cron_expression)
                              : (task.cron_expression || '—')
                            }
                          </span>
                          <span className="flex items-center gap-1">
                            {task.is_active
                              ? <ToggleRight size={12} className="text-emerald-400" />
                              : <ToggleLeft size={12} className="text-zinc-600" />
                            }
                            {task.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                          {task.last_execution_at && (
                            <span>Última: {formatDate(task.last_execution_at)}</span>
                          )}
                          {task.execution_count > 0 && (
                            <span>Ejecuciones: {task.execution_count}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.last_execution_status && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${sb.bg} ${sb.border} border`}>
                            <sb.icon size={10} className={sb.color} />
                            <span className={sb.color}>{sb.label}</span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLogs(task.id);
                          }}
                          className="h-7 w-7 p-0"
                          title="Ver historial"
                        >
                          <FileText size={14} className={expandedLogs[task.id] ? 'text-emerald-400' : 'text-zinc-500'} />
                        </Button>
                      </div>
                    </div>

                    {/* ── Execution logs inline ───────────────────────── */}
                    {expandedLogs[task.id] && (
                      <div className="mt-3 pl-0 border-t border-zinc-800/50 pt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-zinc-500 font-medium">Últimas ejecuciones</span>
                          {!logsMap[task.id]?.loading && logsMap[task.id]?.total > 0 && (
                            <span className="text-[10px] text-zinc-600">{logsMap[task.id].total} registro(s)</span>
                          )}
                        </div>
                        {logsMap[task.id]?.loading ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 size={12} className="animate-spin text-zinc-500" />
                            <span className="text-xs text-zinc-500">Cargando...</span>
                          </div>
                        ) : logsMap[task.id]?.items?.length > 0 ? (
                          <div className="space-y-1">
                            {logsMap[task.id].items.map((entry, i) => {
                              const esb = statusBadge(entry.estado);
                              return (
                                <div key={entry.id || i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                                  <esb.icon size={10} className={esb.color} />
                                  <span>{formatDate(entry.ultima_actualizacion)}</span>
                                  <span className="text-zinc-600">—</span>
                                  <span className="truncate max-w-[200px]">{entry.detalle || entry.estado}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-600 py-1">Sin ejecuciones registradas.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Edit panel (2/5) ──────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          {selectedTask ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                  <Settings2 size={14} className="text-zinc-400" />
                  Configurar: {selectedTask.display_name}
                </h3>
              </div>

              <div className="p-4 space-y-4">
                {/* Task info */}
                <div className="bg-zinc-900/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Tarea:</span>
                    <code className="text-[11px] text-zinc-300 font-mono">{selectedTask.task_name}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Path Celery:</span>
                    <code className="text-[11px] text-zinc-400 font-mono truncate">{selectedTask.celery_task_path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Ejecuciones:</span>
                    <span className="text-xs text-zinc-300">{selectedTask.execution_count}</span>
                    {selectedTask.max_executions != null && (
                      <span className="text-[11px] text-zinc-500">/ {selectedTask.max_executions} máx</span>
                    )}
                  </div>
                </div>

                {/* Schedule Configurator */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                    Schedule
                  </label>
                  <ScheduleConfigurator
                    value={editForm.schedule_config}
                    cronExpression={editForm.cron_expression}
                    onChange={(config) => {
                      setEditForm((f) => ({ ...f, schedule_config: config }));
                    }}
                    onCronChange={(cron) => {
                      setEditForm((f) => ({ ...f, cron_expression: cron }));
                    }}
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium block">Activa</label>
                    <p className="text-[10px] text-zinc-600">
                      {editForm.is_active
                        ? 'La tarea se ejecutará según su schedule'
                        : 'La tarea está desactivada (no se ejecutará automáticamente)'
                      }
                    </p>
                  </div>
                  <Switch
                    checked={editForm.is_active}
                    onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: v }))}
                  />
                </div>

                {/* Max executions */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                    Máximo de ejecuciones
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.max_executions}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_executions: e.target.value }))}
                    placeholder="Vacío = ilimitado"
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Dejar vacío para ejecuciones ilimitadas. 0 = desactivar por límite alcanzado.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving === selectedTask.id}
                    className="h-9 text-xs gap-1.5 flex-1"
                  >
                    {saving === selectedTask.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    {saving === selectedTask.id ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTrigger(selectedTask.id)}
                    disabled={triggering === selectedTask.id}
                    className="h-9 text-xs gap-1.5"
                  >
                    {triggering === selectedTask.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    Ejecutar ahora
                  </Button>
                </div>

                {/* Last execution info */}
                {selectedTask.last_execution_at && (
                  <div className="border-t border-zinc-800 pt-3 mt-2">
                    <h4 className="text-[11px] text-zinc-500 font-medium mb-2">Última ejecución</h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {(() => {
                        const sb = statusBadge(selectedTask.last_execution_status);
                        return (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${sb.bg} ${sb.border} border`}>
                            <sb.icon size={12} className={sb.color} />
                            <span className={sb.color}>{sb.label}</span>
                          </div>
                        );
                      })()}
                      <span>{formatDate(selectedTask.last_execution_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
              <div className="flex flex-col items-center py-12 text-center px-4">
                <Settings2 size={32} className="text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500 mb-1">Seleccioná una tarea</p>
                <p className="text-xs text-zinc-600">Hacé clic en una tarea de la lista para ver y editar su configuración.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
