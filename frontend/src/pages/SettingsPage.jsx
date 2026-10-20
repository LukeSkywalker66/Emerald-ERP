import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Settings,
  Save,
  Loader2,
  Clock,
  Globe,
  Building2,
  Image,
  Users,
  CalendarClock,
  Activity,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Package,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  getAllSettings,
  bulkUpdateSettings,
  settingsToMap,
} from '@/services/settings.service';
import UsersTab from '@/pages/settings/UsersTab';
import MonitorsTab from '@/pages/settings/MonitorsTab';
import ScheduledTasksTab from '@/pages/settings/ScheduledTasksTab';
import WOTemplatesTab from '@/pages/settings/WOTemplatesTab';
import OTTypesTab from '@/pages/settings/OTTypesTab';
import WOActionsTab from '@/pages/settings/WOActionsTab';
import ProductGroupsTab from '@/pages/settings/ProductGroupsTab';
import BackupTab from '@/pages/settings/BackupTab';
import { normalizeWorkHoursSchedule, DEFAULT_WORK_HOURS } from '@/utils/workHours';

// ─── Constants ──────────────────────────────────────────────────────────


const TIMEZONE_OPTIONS = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART, UTC-3)' },
  { value: 'America/Argentina/Cordoba', label: 'Córdoba (ART, UTC-3)' },
  { value: 'America/Argentina/Mendoza', label: 'Mendoza (ART, UTC-3)' },
  { value: 'America/Argentina/Salta', label: 'Salta (ART, UTC-3)' },
  { value: 'America/Argentina/Jujuy', label: 'Jujuy (ART, UTC-3)' },
  { value: 'America/Argentina/Tucuman', label: 'Tucumán (ART, UTC-3)' },
];

const CONFIG_KEYS = {
  COMPANY_NAME: 'company_name',
  LOGO_URL: 'logo_url',
  WORK_HOURS: 'work_hours',
  TIMEZONE: 'timezone',
};

// ─── Helpers ────────────────────────────────────────────────────────────

function normalizeSchedulesForForm(value) {
  const schedules = normalizeWorkHoursSchedule(value);
  return schedules.map((entry) => ({
    ...DEFAULT_WORK_HOURS,
    ...entry,
    effective_from: entry.effective_from || '',
  }));
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user: currentUser } = useAuth();

  // Determinar si el usuario tiene permisos de administración plenos
  const isAdmin = useMemo(
    () => currentUser?.is_superuser || currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
    [currentUser]
  );

  // Si no es admin, forzar la pestaña de usuarios (única que puede ver)
  const defaultTab = isAdmin ? 'general' : 'users';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }

  // Form state — populated from API
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [workHoursSchedules, setWorkHoursSchedules] = useState([{ ...DEFAULT_WORK_HOURS, effective_from: '' }]);
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');

  // ── Load settings from API ──────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getAllSettings();
      const map = settingsToMap(settings);

      setCompanyName(map[CONFIG_KEYS.COMPANY_NAME] || '');
      setLogoUrl(map[CONFIG_KEYS.LOGO_URL] || '');
      setWorkHoursSchedules(
        normalizeSchedulesForForm(map[CONFIG_KEYS.WORK_HOURS])
      );
      setTimezone(map[CONFIG_KEYS.TIMEZONE] || 'America/Argentina/Buenos_Aires');
    } catch (err) {
      console.error('❌ Error loading settings:', err);
      setError('No se pudieron cargar las configuraciones. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Show temporary feedback ─────────────────────────────────────────

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Save general settings ───────────────────────────────────────────

  const handleSaveGeneral = async () => {
    setSaving(true);
    setError(null);

    try {
      // Validate work hours (cada vigencia)
      for (const schedule of workHoursSchedules) {
        if (schedule.morning_end <= schedule.morning_start) {
          showFeedback('error', 'El horario de fin de mañana debe ser posterior al de inicio.');
          setSaving(false);
          return;
        }
        if (schedule.afternoon_end <= schedule.afternoon_start) {
          showFeedback('error', 'El horario de fin de tarde debe ser posterior al de inicio.');
          setSaving(false);
          return;
        }
        if (schedule.afternoon_start <= schedule.morning_end) {
          showFeedback('error', 'El horario de inicio de tarde debe ser posterior al fin de mañana.');
          setSaving(false);
          return;
        }
      }

      // Persistir como array de vigencias ordenado por fecha (asc)
      const schedulesToSave = [...workHoursSchedules]
        .sort((a, b) => String(a.effective_from || '').localeCompare(String(b.effective_from || '')))
        .map(({ effective_from, morning_start, morning_end, afternoon_start, afternoon_end }) => ({
          effective_from: effective_from || null,
          morning_start,
          morning_end,
          afternoon_start,
          afternoon_end,
        }));

      // Build payload with only the keys we manage in General tab
      const payload = {
        [CONFIG_KEYS.COMPANY_NAME]: companyName,
        [CONFIG_KEYS.LOGO_URL]: logoUrl,
        [CONFIG_KEYS.WORK_HOURS]: schedulesToSave,
        [CONFIG_KEYS.TIMEZONE]: timezone,
      };

      await bulkUpdateSettings(payload);
      showFeedback('success', 'Configuración general guardada correctamente.');
    } catch (err) {
      console.error('❌ Error saving settings:', err);
      showFeedback('error', 'Error al guardar la configuración. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Work hours (vigencias) field change ─────────────────────────────

  const handleScheduleChange = (index, field, value) => {
    setWorkHoursSchedules((prev) =>
      prev.map((schedule, i) => (i === index ? { ...schedule, [field]: value } : schedule))
    );
  };

  const handleAddSchedule = () => {
    setWorkHoursSchedules((prev) => [...prev, { ...DEFAULT_WORK_HOURS, effective_from: '' }]);
  };

  const handleRemoveSchedule = (index) => {
    setWorkHoursSchedules((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // ── Render: Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  // ── Render: Error (full page) ───────────────────────────────────────

  if (error && !saving) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Settings className="text-emerald-400" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Ajustes</h1>
              <p className="text-sm text-zinc-400">Configuración general del sistema</p>
            </div>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Button variant="outline" onClick={loadSettings}>
          Reintentar
        </Button>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Settings className="text-emerald-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ajustes</h1>
            <p className="text-sm text-zinc-400">
              {isAdmin ? 'Configuración general del sistema' : 'Gestión de tu cuenta'}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback alert */}
      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{feedback.type === 'success' ? 'Guardado' : 'Error'}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      {/* Tabs: admin ve todas, no-admin solo Usuarios (auto-gestión) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto flex-wrap">
          {isAdmin && (
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe size={16} />
              General
            </TabsTrigger>
          )}
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users size={16} />
            Usuarios
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <CalendarClock size={16} />
              Tareas Programadas
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="monitors" className="flex items-center gap-2">
              <Activity size={16} />
              Monitores de Servicio
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="work-orders" className="flex items-center gap-2">
              <ClipboardList size={16} />
              Órdenes de Trabajo
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="product-groups" className="flex items-center gap-2">
              <Package size={16} />
              Grupos de Producto
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <HardDrive size={16} />
              Backup
            </TabsTrigger>
          )}
        </TabsList>

        {/* ═══ General Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="general" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 mb-6">Configuración General</h2>

              <div className="space-y-4">
                {/* Company Name */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <label className="block text-zinc-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Building2 size={16} className="text-zinc-500" />
                    Nombre de la Empresa
                  </label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="2F INTERNET ARGENTINA S.A."
                  />
                  <p className="text-zinc-500 text-xs mt-2">
                    Nombre que se mostrará en la interfaz y reportes del sistema.
                  </p>
                </div>

                {/* Logo URL */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <label className="block text-zinc-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Image size={16} className="text-zinc-500" />
                    URL del Logo
                  </label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://ejemplo.com/logo.png"
                  />
                  <p className="text-zinc-500 text-xs mt-2">
                    URL pública del logo de la empresa. Se mostrará en el sidebar y login.
                  </p>
                  {logoUrl && (
                    <div className="mt-3 flex items-center gap-3 p-2 rounded bg-zinc-900/50 border border-zinc-800/50">
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="h-10 w-10 object-contain rounded"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-zinc-500">Vista previa</span>
                    </div>
                  )}
                </div>

                {/* Work Hours (con vigencia por fecha) */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-zinc-300 text-sm font-medium flex items-center gap-2">
                      <Clock size={16} className="text-zinc-500" />
                      Horario de Visitas Técnicas
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddSchedule}>
                      + Agregar vigencia
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {workHoursSchedules.map((schedule, index) => (
                      <div
                        key={index}
                        className="space-y-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs text-zinc-400">Vigente desde</label>
                            <Input
                              type="date"
                              value={schedule.effective_from}
                              onChange={(e) => handleScheduleChange(index, 'effective_from', e.target.value)}
                              className="max-w-[180px]"
                            />
                          </div>
                          {workHoursSchedules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSchedule(index)}
                              className="text-xs text-rose-400 hover:text-rose-300"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Morning */}
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Turno Mañana</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">Inicio</label>
                                <Input
                                  type="time"
                                  value={schedule.morning_start}
                                  onChange={(e) => handleScheduleChange(index, 'morning_start', e.target.value)}
                                />
                              </div>
                              <span className="text-zinc-600 mt-6">→</span>
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">Fin</label>
                                <Input
                                  type="time"
                                  value={schedule.morning_end}
                                  onChange={(e) => handleScheduleChange(index, 'morning_end', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Afternoon */}
                          <div className="space-y-2 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Turno Tarde</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">Inicio</label>
                                <Input
                                  type="time"
                                  value={schedule.afternoon_start}
                                  onChange={(e) => handleScheduleChange(index, 'afternoon_start', e.target.value)}
                                />
                              </div>
                              <span className="text-zinc-600 mt-6">→</span>
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">Fin</label>
                                <Input
                                  type="time"
                                  value={schedule.afternoon_end}
                                  onChange={(e) => handleScheduleChange(index, 'afternoon_end', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-zinc-500 text-xs mt-3">
                    Cada vigencia aplica desde su fecha en adelante, hasta la vigencia siguiente. Esto permite cambiar el horario sin alterar las planificaciones de días anteriores.
                  </p>
                </div>

                {/* Timezone */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <label className="block text-zinc-300 text-sm font-medium mb-2 flex items-center gap-2">
                    <Globe size={16} className="text-zinc-500" />
                    Zona Horaria
                  </label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar zona horaria" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-zinc-500 text-xs mt-2">
                    Zona horaria del sistema. Afecta los registros de tiempo y programación de tareas.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={handleSaveGeneral}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Guardar Cambios
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={loadSettings} disabled={saving}>
                  Descartar cambios
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ═══ Users Tab (todos los roles) ═══ */}
        <TabsContent value="users" className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-50 mb-6">Gestión de Usuarios</h2>
            <UsersTab />
          </div>
        </TabsContent>

        {/* ═══ Scheduled Tasks Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="tasks" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 mb-6">Tareas Programadas</h2>
              <ScheduledTasksTab />
            </div>
          </TabsContent>
        )}

        {/* ═══ Service Monitors Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="monitors" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 mb-6">Monitores de Servicio</h2>
              <MonitorsTab />
            </div>
          </TabsContent>
        )}

        {/* ═══ Work Orders Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="work-orders" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 mb-6">Configuración de Órdenes de Trabajo</h2>
              
              {/* Sección: Tipos de OT */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 mb-8">
                <h3 className="text-sm font-semibold text-white mb-1">Tipos de Orden de Trabajo</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Configurá los nombres, colores e íconos de los tipos de OT disponibles.
                  Tipos base: Instalación FTTH, Instalación Aire, Reclamo, Baja e Infraestructura.
                </p>
                <OTTypesTab />
              </div>

              {/* Sección: Acciones de Resolución */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 mb-8">
                <h3 className="text-sm font-semibold text-white mb-1">Acciones de Resolución</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Configurá las acciones disponibles al completar una OT, agrupadas por tipo de OT.
                  "No Realizada" y "Realizada" son acciones built-in para todos los tipos.
                </p>
                <WOActionsTab />
              </div>

              {/* Separador visual */}
              <div className="border-t border-zinc-800 my-8"></div>

              {/* Sección: Plantillas de Materiales */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
                <h3 className="text-sm font-semibold text-white mb-1">Plantillas de Materiales por Tipo de OT</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Definí listas de productos sugeridos que los técnicos verán precargados al agregar materiales.
                </p>
                <WOTemplatesTab />
              </div>
            </div>
          </TabsContent>
        )}

        {/* ═══ Product Groups Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="product-groups" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 mb-6">Grupos de Producto</h2>
              <ProductGroupsTab />
            </div>
          </TabsContent>
        )}

        {/* ═══ Backup Tab (solo admin) ═══ */}
        {isAdmin && (
          <TabsContent value="backup" className="space-y-6">
            <BackupTab />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}
