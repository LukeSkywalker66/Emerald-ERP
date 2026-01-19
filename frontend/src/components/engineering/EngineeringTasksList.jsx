/**
 * EngineeringTasksList - Visualización de tareas técnicas asociadas a un ticket
 * 
 * Muestra lista de tareas de NOC/Ingeniería con estados, prioridades y resoluciones
 */
import React from 'react';
import { User, Clock, CheckCircle, XCircle, AlertCircle, Loader as LoaderIcon } from 'lucide-react';

// Configuración de estados
const STATUS_CONFIG = {
  backlog: { 
    label: 'Planificación', 
    color: 'bg-zinc-700/60 border-zinc-600 text-zinc-200',
    icon: Clock,
  },
  in_progress: { 
    label: 'En ejecución', 
    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    icon: LoaderIcon,
  },
  testing: { 
    label: 'Validación', 
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    icon: AlertCircle,
  },
  completed: { 
    label: 'Completada', 
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    icon: CheckCircle,
  },
  rejected: { 
    label: 'Rechazada', 
    color: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    icon: XCircle,
  },
};

const PRIORITY_CONFIG = {
  low: { label: 'Baja', color: 'text-zinc-400' },
  medium: { label: 'Media', color: 'text-amber-300' },
  high: { label: 'Alta', color: 'text-orange-400' },
  critical: { label: 'Crítica', color: 'text-rose-400' },
};

const TASK_TYPE_CONFIG = {
  incident: { label: 'Incidente', icon: '🔥' },
  maintenance: { label: 'Mantenimiento', icon: '🔧' },
  project: { label: 'Proyecto', icon: '🚀' },
};

export default function EngineeringTasksList({ tasks, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-400">
        <LoaderIcon size={18} className="animate-spin mr-2" />
        Cargando tareas de ingeniería...
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-center">
        <p className="text-sm text-zinc-500">
          No hay tareas de ingeniería asociadas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog;
        const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
        const typeConfig = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.incident;
        const StatusIcon = statusConfig.icon;

        return (
          <div
            key={task.id}
            className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-500">
                    #{task.id}
                  </span>
                  <span className="text-sm" title={typeConfig.label}>
                    {typeConfig.icon}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white line-clamp-1">
                  {task.title}
                </h4>
              </div>

              <span className={`text-xs border px-2 py-1 rounded-md ${statusConfig.color} flex items-center gap-1`}>
                <StatusIcon size={12} />
                {statusConfig.label}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {/* Prioridad */}
              <div className="flex items-center gap-1">
                <AlertCircle size={12} className={priorityConfig.color} />
                <span className={priorityConfig.color}>
                  {priorityConfig.label}
                </span>
              </div>

              {/* Asignado a */}
              {task.assigned_to ? (
                <div className="flex items-center gap-1" title="Asignado a">
                  <User size={12} className="text-emerald-400" />
                  <span className="text-emerald-300 truncate">
                    {task.assigned_to.full_name || task.assigned_to.email}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <User size={12} className="text-zinc-600" />
                  <span className="text-zinc-600">Sin asignar</span>
                </div>
              )}

              {/* Fecha programada */}
              {task.scheduled_date && (
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>
                    {new Date(task.scheduled_date).toLocaleDateString('es-AR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Resolución (si completada o rechazada) */}
            {(task.status === 'completed' || task.status === 'rejected') && (task.resolution_note || task.rejection_reason) && (
              <div className={`mt-3 p-3 rounded-lg border ${
                task.status === 'completed' 
                  ? 'bg-emerald-950/30 border-emerald-700/50' 
                  : 'bg-rose-950/30 border-rose-700/50'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  task.status === 'completed' ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {task.status === 'completed' ? '✓ Resolución' : '✗ Motivo de rechazo'}
                </p>
                <p className="text-xs text-zinc-300">
                  {task.resolution_note || task.rejection_reason}
                </p>
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-600">
              {new Date(task.created_at).toLocaleDateString('es-AR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
