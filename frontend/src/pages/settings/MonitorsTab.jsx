/**
 * MonitorsTab.jsx
 * CRUD de Monitores de Servicio embebido en SettingsPage
 * Backend endpoints: /api/v2/settings/monitors
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  checkMonitor,
} from '@/services/settings.service';

// ─── Constants ──────────────────────────────────────────────────────────

const MONITOR_TYPES = [
  { value: 'PING', label: 'Ping' },
  { value: 'HTTP', label: 'HTTP' },
  { value: 'TCP', label: 'Puerto (TCP)' },
];

const CRITICALITY_OPTIONS = [
  { value: 1, label: '1 - Baja', color: 'text-zinc-400' },
  { value: 2, label: '2 - Media', color: 'text-yellow-500' },
  { value: 3, label: '3 - Alta', color: 'text-orange-500' },
  { value: 4, label: '4 - Crítica', color: 'text-red-500' },
];

const DEFAULT_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

const INTERVAL_OPTIONS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hora' },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function statusConfig(status) {
  switch (status?.toUpperCase()) {
    case 'UP':
      return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Online' };
    case 'DOWN':
      return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Offline' };
    case 'DEGRADED':
      return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Degradado' };
    default:
      return { icon: HelpCircle, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Desconocido' };
  }
}

function formatLastChecked(dateStr) {
  if (!dateStr) return 'Nunca';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatResponseTime(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function MonitorsTab() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingId, setCheckingId] = useState(null); // monitor id being checked

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null); // null = create, object = edit
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    label: '',
    url: '',
    monitor_type: 'HTTP',
    criticality_index: 2,
    alert_color: '#22c55e',
    check_interval_seconds: 300,
    is_active: true,
    auth_username: '',
    auth_password: '',
    tags: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // ── Load monitors ──────────────────────────────────────────────────

  const loadMonitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMonitors();
      setMonitors(data?.items || []);
    } catch (err) {
      console.error('❌ Error loading monitors:', err);
      setError('No se pudieron cargar los monitores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  // ── Form helpers ────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({
      label: '',
      url: '',
      monitor_type: 'HTTP',
      criticality_index: 2,
      alert_color: '#22c55e',
      check_interval_seconds: 300,
      is_active: true,
      auth_username: '',
      auth_password: '',
      tags: '',
      notes: '',
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    setEditingMonitor(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (monitor) => {
    setEditingMonitor(monitor);
    setForm({
      label: monitor.label || '',
      url: monitor.url || '',
      monitor_type: monitor.monitor_type || 'HTTP',
      criticality_index: monitor.criticality_index ?? 2,
      alert_color: monitor.alert_color || '#22c55e',
      check_interval_seconds: monitor.check_interval_seconds ?? 300,
      is_active: monitor.is_active ?? true,
      auth_username: monitor.auth_username || '',
      auth_password: '',
      tags: monitor.tags ? (typeof monitor.tags === 'string' ? monitor.tags : JSON.stringify(monitor.tags)) : '',
      notes: monitor.notes || '',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.label.trim()) errors.label = 'La etiqueta es obligatoria';
    if (!form.url.trim()) errors.url = 'La URL es obligatoria';
    else if (!/^https?:\/\//i.test(form.url) && form.monitor_type === 'HTTP') {
      errors.url = 'La URL debe comenzar con http:// o https://';
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.alert_color)) {
      errors.alert_color = 'Color hexadecimal inválido (ej: #22c55e)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── CRUD Handlers ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        label: form.label.trim(),
        url: form.url.trim(),
        monitor_type: form.monitor_type?.toUpperCase() || 'HTTP',
        criticality_index: form.criticality_index,
        alert_color: form.alert_color,
        check_interval_seconds: form.check_interval_seconds,
        is_active: form.is_active,
        auth_username: form.auth_username.trim() || undefined,
        auth_password: form.auth_password || undefined,
        tags: form.tags
          ? (() => {
              try {
                return typeof form.tags === 'string'
                  ? JSON.parse(form.tags)
                  : form.tags;
              } catch {
                return undefined;
              }
            })()
          : undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingMonitor) {
        await updateMonitor(editingMonitor.id, payload);
      } else {
        await createMonitor(payload);
      }

      setDialogOpen(false);
      await loadMonitors();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert(`Error al guardar monitor: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (monitor) => {
    setMonitorToDelete(monitor);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!monitorToDelete) return;
    setDeleting(true);
    try {
      await deleteMonitor(monitorToDelete.id);
      setDeleteDialogOpen(false);
      setMonitorToDelete(null);
      await loadMonitors();
    } catch (err) {
      alert(`Error al eliminar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCheck = async (monitorId) => {
    setCheckingId(monitorId);
    try {
      const result = await checkMonitor(monitorId);
      await loadMonitors();
      if (result.status === 'UP') {
        alert(`✅ ${result.label}: Online (${result.response_time_ms?.toFixed(0) || '?'}ms)`);
      } else if (result.status === 'DOWN') {
        alert(`❌ ${result.label}: Offline — ${result.error_message || 'Sin respuesta'}`);
      } else {
        alert(`⚠️ ${result.label}: Sin verificar — ${result.error_message || 'Estado desconocido'}`);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error de conexión';
      alert(`⚠️ Error al verificar: ${msg}`);
    } finally {
      setCheckingId(null);
    }
  };

  // ── Filtered monitors ───────────────────────────────────────────────

  const filteredMonitors = monitors.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.label?.toLowerCase().includes(q) ||
      m.url?.toLowerCase().includes(q) ||
      m.monitor_type?.toLowerCase().includes(q)
    );
  });

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar monitores..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadMonitors} disabled={loading} className="h-9">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700 h-9">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Monitor
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && monitors.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {(() => {
            const total = monitors.length;
            const up = monitors.filter((m) => m.last_status === 'up').length;
            const down = monitors.filter((m) => m.last_status === 'down').length;
            const degraded = monitors.filter((m) => m.last_status === 'degraded').length;
            return (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs">
                  <Activity size={14} className="text-zinc-400" />
                  <span className="text-zinc-400">Total:</span>
                  <span className="text-zinc-100 font-medium">{total}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-zinc-400">Online:</span>
                  <span className="text-emerald-400 font-medium">{up}</span>
                </div>
                {degraded > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-zinc-400">Degradados:</span>
                    <span className="text-amber-400 font-medium">{degraded}</span>
                  </div>
                )}
                {down > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-xs">
                    <XCircle size={14} className="text-red-400" />
                    <span className="text-zinc-400">Offline:</span>
                    <span className="text-red-400 font-medium">{down}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center py-12 text-center">
            <XCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm text-zinc-300 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadMonitors}>Reintentar</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : filteredMonitors.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={32} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-500">
              {searchQuery ? 'No se encontraron monitores.' : 'No hay monitores configurados. Crea el primero.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400 text-xs uppercase">Estado</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase">Etiqueta</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase hidden md:table-cell">URL</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase">Tipo</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase hidden lg:table-cell">Criticidad</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase hidden lg:table-cell">Tiempo Resp.</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase hidden sm:table-cell">Últ. Check</TableHead>
                  <TableHead className="text-zinc-400 text-xs uppercase text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonitors.map((monitor) => {
                  const st = statusConfig(monitor.last_status);
                  const StatusIcon = st.icon;
                  const crit = CRITICALITY_OPTIONS.find((c) => c.value === monitor.criticality_index);
                  return (
                    <TableRow key={monitor.id} className="border-zinc-800 hover:bg-zinc-800/30">
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${st.bg} ${st.border} border`}>
                          <StatusIcon size={12} className={st.color} />
                          <span className={st.color}>{st.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: monitor.alert_color || '#22c55e' }}
                          />
                          <span className="text-sm font-medium text-zinc-100">{monitor.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm max-w-[200px] truncate hidden md:table-cell">
                        <span title={monitor.url}>{monitor.url}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                          {monitor.monitor_type?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {crit ? (
                          <span className={`text-xs font-medium ${crit.color}`}>{crit.label}</span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 hidden lg:table-cell">
                        {formatResponseTime(monitor.response_time_ms)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 hidden sm:table-cell">
                        {formatLastChecked(monitor.last_checked_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCheck(monitor.id)}
                            disabled={checkingId === monitor.id}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                            title="Verificar ahora"
                          >
                            {checkingId === monitor.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <ExternalLink size={14} />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(monitor)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(monitor)}
                            className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ═══ Dialog: Crear / Editar Monitor ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-emerald-500" />
              {editingMonitor ? 'Editar Monitor' : 'Nuevo Monitor'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Etiqueta *</label>
              <Input
                value={form.label}
                onChange={(e) => handleFormChange('label', e.target.value)}
                placeholder="Monitor WAN Principal"
                className={formErrors.label ? 'border-red-500' : ''}
              />
              {formErrors.label && <p className="text-xs text-red-400 mt-1">{formErrors.label}</p>}
            </div>

            {/* URL + Type row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">URL *</label>
                <Input
                  value={form.url}
                  onChange={(e) => handleFormChange('url', e.target.value)}
                  placeholder={
                    form.monitor_type === 'PING'
                      ? '8.8.8.8'
                      : form.monitor_type === 'TCP'
                      ? '192.168.1.1:22'
                      : 'https://ejemplo.com/health'
                  }
                  className={formErrors.url ? 'border-red-500' : ''}
                />
                {formErrors.url && <p className="text-xs text-red-400 mt-1">{formErrors.url}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo</label>
                <Select value={form.monitor_type} onValueChange={(v) => handleFormChange('monitor_type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONITOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Criticidad + Intervalo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Criticidad</label>
                <Select
                  value={String(form.criticality_index)}
                  onValueChange={(v) => handleFormChange('criticality_index', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITICALITY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={String(c.value)}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Intervalo de Check</label>
                <Select
                  value={String(form.check_interval_seconds)}
                  onValueChange={(v) => handleFormChange('check_interval_seconds', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color de Alerta */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Color de Alerta</label>
              <div className="flex items-center gap-3">
                <Input
                  value={form.alert_color}
                  onChange={(e) => handleFormChange('alert_color', e.target.value)}
                  placeholder="#22c55e"
                  className={`w-32 font-mono ${formErrors.alert_color ? 'border-red-500' : ''}`}
                />
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleFormChange('alert_color', color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        form.alert_color === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {formErrors.alert_color && <p className="text-xs text-red-400 mt-1">{formErrors.alert_color}</p>}
            </div>

            {/* Activo */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleFormChange('is_active', e.target.checked)}
                  className="rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-300">Monitor activo</span>
              </label>
            </div>

            {/* Auth (opcional) */}
            <div className="border-t border-zinc-800 pt-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Autenticación (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Usuario</label>
                  <Input
                    value={form.auth_username}
                    onChange={(e) => handleFormChange('auth_username', e.target.value)}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Contraseña</label>
                  <Input
                    type="password"
                    value={form.auth_password}
                    onChange={(e) => handleFormChange('auth_password', e.target.value)}
                    placeholder={editingMonitor ? '(dejar vacío para mantener)' : '••••••••'}
                  />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Información adicional sobre este monitor..."
                rows={2}
                className="flex w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? (
                <><Loader2 size={14} className="animate-spin mr-2" />Guardando...</>
              ) : (
                editingMonitor ? 'Guardar Cambios' : 'Crear Monitor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Confirmar Eliminación ═══ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-5 w-5 text-red-500" />
              Eliminar Monitor
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-300">
            ¿Estás seguro de eliminar <strong>{monitorToDelete?.label}</strong>?
          </p>
          <p className="text-xs text-zinc-500">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
