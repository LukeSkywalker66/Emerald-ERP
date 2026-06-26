import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CloudUpload,
  Server,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getBackupConfig,
  updateBackupConfig,
  listBackupRuns,
  triggerBackupNow,
} from '@/services/settings.service';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const map = {
    success:  { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', label: 'Exitoso',   icon: <CheckCircle2 size={12} /> },
    failed:   { color: 'text-red-400 bg-red-400/10 border-red-400/30',             label: 'Fallido',   icon: <XCircle size={12} /> },
    running:  { color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',        label: 'Ejecutando',icon: <Loader2 size={12} className="animate-spin" /> },
    pending:  { color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',           label: 'Pendiente', icon: <Clock size={12} /> },
  };
  const { color, label, icon } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${color}`}>
      {icon}{label}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export default function BackupTab() {
  const appEnv = import.meta.env.VITE_APP_ENV || 'development';
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);

  // Form state sincronizado con config
  const [form, setForm] = useState({
    is_enabled: false,
    cron_expression: '0 2 * * *',
    drive_remote_name: 'gdrive',
    drive_folder_id: 'Emerald_ERP_BackUps',
    retention_days: 7,
    backup_dir: '/app/data/backups',
    lan_backup_enabled: false,
    lan_server_ip: '',
    lan_server_user: '',
    lan_dest_folder: '',
    lan_ssh_key_path: '/root/.ssh/id_ed25519',
    include_minio_backup: true,
    minio_bucket: 'emerald-attachments',
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const data = await getBackupConfig();
      setConfig(data);
      setForm({
        is_enabled: data.is_enabled,
        cron_expression: data.cron_expression,
        drive_remote_name: data.drive_remote_name,
        drive_folder_id: data.drive_folder_id,
        retention_days: data.retention_days,
        backup_dir: data.backup_dir,
        lan_backup_enabled: data.lan_backup_enabled,
        lan_server_ip: data.lan_server_ip || '',
        lan_server_user: data.lan_server_user || '',
        lan_dest_folder: data.lan_dest_folder || '',
        lan_ssh_key_path: data.lan_ssh_key_path || '/root/.ssh/id_ed25519',
        include_minio_backup: data.include_minio_backup !== undefined ? data.include_minio_backup : true,
        minio_bucket: data.minio_bucket || 'emerald-attachments',
      });
    } catch {
      setErrorMsg('Error al cargar la configuración de backup');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      const data = await listBackupRuns(20);
      setRuns(data.items || []);
      setTotalRuns(data.total || 0);
    } catch {
      // silencioso, la tabla mostrará vacío
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchRuns();
  }, [fetchConfig, fetchRuns]);

  const handleSave = async () => {
    try {
      setSavingConfig(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const payload = {
        ...form,
        retention_days: Number(form.retention_days),
        lan_server_ip: form.lan_server_ip || null,
        lan_server_user: form.lan_server_user || null,
        lan_dest_folder: form.lan_dest_folder || null,
        lan_ssh_key_path: form.lan_ssh_key_path || null,
        minio_bucket: form.minio_bucket || 'emerald-attachments',
      };
      const updated = await updateBackupConfig(payload);
      setConfig(updated);
      setSuccessMsg('Configuración guardada correctamente');
    } catch {
      setErrorMsg('Error al guardar la configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setTriggering(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await triggerBackupNow();
      setSuccessMsg('Backup iniciado. El proceso corre en segundo plano — revisá el historial en unos minutos.');
      setTimeout(fetchRuns, 3000);
    } catch {
      setErrorMsg('Error al iniciar el backup manual');
    } finally {
      setTriggering(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
            <HardDrive size={20} className="text-emerald-400" />
            Backup Automático de Base de Datos
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Genera dumps de la BD de producción y los sube a Google Drive vía rclone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchConfig(); fetchRuns(); }}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw size={14} className="mr-1" />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={handleRunNow}
            disabled={triggering}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {triggering ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Play size={14} className="mr-1" />}
            Ejecutar ahora
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {successMsg}
        </div>
      )}

      {/* ─── Config Form ─── */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5 space-y-5">
        {/* Habilitar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium">Backups automáticos</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Desactivado por defecto en entornos no-productivos.
            </p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_enabled: !f.is_enabled }))}
            className="text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            {form.is_enabled
              ? <ToggleRight size={32} className="text-emerald-400" />
              : <ToggleLeft size={32} />}
          </button>
        </div>

        <hr className="border-zinc-800" />

        {/* Schedule */}
        <div>
          <label className="block text-zinc-300 text-sm font-medium mb-1 flex items-center gap-2">
            <Clock size={14} className="text-zinc-500" />
            Expresión cron (schedule)
          </label>
          <Input
            value={form.cron_expression}
            onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
            placeholder="0 2 * * *"
            className="font-mono text-sm"
          />
          <p className="text-zinc-500 text-xs mt-1">
            Formato Celery Beat. Ejemplos: <code className="text-zinc-400">0 2 * * *</code> (2:00 AM diario) · <code className="text-zinc-400">0 3 * * 1-5</code> (3 AM lunes-viernes).
            <br />
            ⚠️ Requiere reinicio del worker Celery para que el nuevo schedule tome efecto.
          </p>
        </div>

        {/* Drive */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-1 flex items-center gap-2">
              <CloudUpload size={14} className="text-zinc-500" />
              Remoto rclone
            </label>
            <Input
              value={form.drive_remote_name}
              onChange={e => setForm(f => ({ ...f, drive_remote_name: e.target.value }))}
              placeholder="gdrive"
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-1">
              Carpeta destino Drive
            </label>
            <Input
              value={form.drive_folder_id}
              onChange={e => setForm(f => ({ ...f, drive_folder_id: e.target.value }))}
              placeholder="Emerald_ERP_BackUps"
            />
          </div>
        </div>

        {/* Retención y directorio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-1">
              Retención (días)
            </label>
            <Input
              type="number"
              min={1}
              max={365}
              value={form.retention_days}
              onChange={e => setForm(f => ({ ...f, retention_days: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-1">
              Directorio temporal
            </label>
            <Input
              value={form.backup_dir}
              onChange={e => setForm(f => ({ ...f, backup_dir: e.target.value }))}
              placeholder="/app/data/backups"
              className="font-mono text-sm"
            />
            <p className="text-zinc-500 text-xs mt-1">
              Ruta en el contenedor. Mapea a <code className="text-zinc-400">/opt/emerald-{appEnv}/data/backups</code> en el host. Cada entorno tiene su propio directorio.
            </p>
          </div>
        </div>

        <hr className="border-zinc-800" />

        {/* LAN Backup */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium flex items-center gap-2">
              <Server size={14} className="text-zinc-500" />
              Réplica en red local (LAN)
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Copia adicional a un servidor en la misma red vía SCP.
            </p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, lan_backup_enabled: !f.lan_backup_enabled }))}
            className="text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            {form.lan_backup_enabled
              ? <ToggleRight size={32} className="text-emerald-400" />
              : <ToggleLeft size={32} />}
          </button>
        </div>

        {form.lan_backup_enabled && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-zinc-700">
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">IP Servidor LAN</label>
              <Input value={form.lan_server_ip} onChange={e => setForm(f => ({ ...f, lan_server_ip: e.target.value }))} placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Usuario SSH</label>
              <Input value={form.lan_server_user} onChange={e => setForm(f => ({ ...f, lan_server_user: e.target.value }))} placeholder="backup-user" />
            </div>
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Carpeta destino</label>
              <Input value={form.lan_dest_folder} onChange={e => setForm(f => ({ ...f, lan_dest_folder: e.target.value }))} placeholder="/volume1/backups/emerald/" className="font-mono text-xs" />
            </div>
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Ruta clave SSH</label>
              <Input value={form.lan_ssh_key_path} onChange={e => setForm(f => ({ ...f, lan_ssh_key_path: e.target.value }))} placeholder="/root/.ssh/id_ed25519" className="font-mono text-xs" />
            </div>
          </div>
        )}

        <hr className="border-zinc-800" />

        {/* MinIO Backup */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium flex items-center gap-2">
              📦
              Respaldo de MinIO (Adjuntos)
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Incluir bucket MinIO (fotos, capturas, reportes) en el backup comprimido.
            </p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, include_minio_backup: !f.include_minio_backup }))}
            className="text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            {form.include_minio_backup
              ? <ToggleRight size={32} className="text-emerald-400" />
              : <ToggleLeft size={32} />}
          </button>
        </div>

        {form.include_minio_backup && (
          <div className="pl-4 border-l-2 border-zinc-700">
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Bucket MinIO</label>
              <Input value={form.minio_bucket} onChange={e => setForm(f => ({ ...f, minio_bucket: e.target.value }))} placeholder="emerald-attachments" className="font-mono text-xs" />
              <p className="text-zinc-500 text-xs mt-0.5">Nombre del bucket a respaldar desde MinIO.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={savingConfig}
            className="bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            {savingConfig ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            Guardar configuración
          </Button>
        </div>
      </div>

      {/* ─── Historial de ejecuciones ─── */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-200">
            Historial de Ejecuciones
            {totalRuns > 0 && <span className="ml-2 text-zinc-500 font-normal">({totalRuns} total)</span>}
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchRuns} className="text-zinc-500 hover:text-zinc-300 h-7 px-2">
            <RefreshCw size={12} />
          </Button>
        </div>

        {loadingRuns ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            <Loader2 size={16} className="animate-spin mr-2" />Cargando...
          </div>
        ) : runs.length === 0 ? (
          <p className="text-center py-8 text-zinc-500 text-sm">
            Aún no hay ejecuciones registradas.
          </p>
        ) : (
          <div className="space-y-1">
            {runs.map(run => (
              <div key={run.id}>
                <button
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors text-left"
                >
                  <StatusBadge status={run.status} />
                  <span className="text-xs text-zinc-400 w-36 shrink-0">{formatDate(run.started_at)}</span>
                  <span className="text-xs text-zinc-300 flex-1 truncate">{run.filename || '—'}</span>
                  <span className="text-xs text-zinc-500 shrink-0">{formatBytes(run.size_bytes)}</span>
                  <span className={`text-xs shrink-0 ${run.triggered_by === 'manual' ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {run.triggered_by === 'manual' ? 'manual' : 'auto'}
                  </span>
                </button>
                {expandedRun === run.id && (
                  <div className="mx-3 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                    {run.error_message && (
                      <p className="text-red-400 text-xs mb-2">Error: {run.error_message}</p>
                    )}
                    {run.log_output ? (
                      <pre className="text-zinc-400 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {run.log_output}
                      </pre>
                    ) : (
                      <p className="text-zinc-600 text-xs">Sin log disponible.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
