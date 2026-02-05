/**
 * DraggableWorkOrderCard.jsx (REDISEÑADO)
 * 
 * Tarjeta arrastrable con:
 * - Drag handle separado (6 puntos a la izquierda)
 * - Cuerpo clickeable que abre CoordinationSheet
 * - Indicadores de estado y duración
 */

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  GripVertical,
  Clock,
  AlertTriangle,
  Phone,
  User,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CoordinationSheet from './CoordinationSheet';

const PRIORITY_CONFIG = {
  critical: {
    label: 'Crítica',
    color: 'border-l-4 border-red-600 bg-red-950/20',
    textColor: 'text-red-300',
    badgeClass: 'bg-red-600 text-red-100',
    icon: AlertTriangle,
  },
  high: {
    label: 'Alta',
    color: 'border-l-4 border-orange-600 bg-orange-950/20',
    textColor: 'text-orange-300',
    badgeClass: 'bg-orange-600 text-orange-100',
    icon: AlertCircle,
  },
  medium: {
    label: 'Media',
    color: 'border-l-4 border-amber-600 bg-amber-950/20',
    textColor: 'text-amber-300',
    badgeClass: 'bg-amber-600 text-amber-100',
    icon: Clock,
  },
  low: {
    label: 'Baja',
    color: 'border-l-4 border-emerald-600 bg-emerald-950/20',
    textColor: 'text-emerald-300',
    badgeClass: 'bg-emerald-600 text-emerald-100',
    icon: Clock,
  },
};

export default function DraggableWorkOrderCard({
  workOrder,
  onQuickAction,
  isDragging = false,
}) {
  const [showCoordinationSheet, setShowCoordinationSheet] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [duration, setDuration] = useState(workOrder?.estimated_duration || 60);
  
  const priority = workOrder.ticket?.priority || 'low';
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
  const PriorityIcon = priorityConfig.icon;

  // Calcular antigüedad
  const createdAt = workOrder.created_at ? new Date(workOrder.created_at) : null;
  const ageText = createdAt
    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: es })
    : 'Fecha desconocida';

  // Handlers de drag
  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(workOrder));
    e.dataTransfer.setData('workOrderId', workOrder.id.toString());
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
  };

  return (
    <>
      {/* TARJETA PRINCIPAL */}
      <div
        draggable
        onDragStart={handleDragStart}
        className={cn(
          'rounded-lg transition-all border-2 border-dashed',
          priorityConfig.color,
          isDragging && 'opacity-50 scale-95 shadow-lg'
        )}
      >
        <div className="flex gap-0">
          {/* ========== DRAG HANDLE (Izquierda) ========== */}
          <div
            className={cn(
              'flex items-center justify-center py-3 px-2 cursor-grab active:cursor-grabbing flex-shrink-0',
              'border-r border-zinc-700/50 hover:bg-zinc-800/40'
            )}
          >
            <GripVertical
              size={16}
              className={cn(
                'transition-colors',
                isDragging ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'
              )}
            />
          </div>

          {/* ========== CONTENIDO (Centro-Derecha) ========== */}
          <button
            onClick={() => setShowCoordinationSheet(true)}
            className="flex-1 text-left p-3 hover:bg-zinc-800/20 transition-colors rounded-r-lg"
          >
            {/* Header: ID + Prioridad */}
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs font-bold text-white">OT #{workOrder.id}</span>
              <div className="flex items-center gap-1">
                <PriorityIcon size={12} className={priorityConfig.textColor} />
                <Badge className={`text-xs font-semibold ${priorityConfig.badgeClass}`}>
                  {priorityConfig.label}
                </Badge>
              </div>
            </div>

            {/* Dirección */}
            <div className="mb-2">
              <p className="text-xs text-zinc-300 line-clamp-2 font-medium">
                {workOrder.ticket?.address || 'Sin dirección'}
              </p>
            </div>

            {/* Cliente */}
            {(workOrder.ticket?.client_name || workOrder.client_name) && (
              <div className="flex items-center gap-1 mb-2 text-xs text-zinc-400">
                <User size={12} />
                <span className="truncate">
                  {workOrder.ticket?.client_name || workOrder.client_name}
                </span>
              </div>
            )}

            {/* Antigüedad + Duración */}
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
              <span>📅 {ageText}</span>
              <Badge
                variant="secondary"
                className="bg-zinc-700/50 text-zinc-300 text-xs font-mono"
              >
                <Clock size={10} className="mr-1" />
                {duration}m
              </Badge>
            </div>

            {/* Indicadores especiales */}
            <div className="flex items-center gap-2 text-xs">
              {/* Disponibilidad del cliente */}
              {workOrder.ticket?.availability_note && (
                <Badge
                  variant="outline"
                  className="border-emerald-700/50 text-emerald-300 text-xs"
                >
                  <Clock size={10} className="mr-1" />
                  Disponibilidad
                </Badge>
              )}

              {/* Intentos fallidos */}
              {failedAttempts > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-950/30 text-red-300">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>
                    {failedAttempts} intento{failedAttempts > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* COORDINATION SHEET */}
      <CoordinationSheet
        workOrder={workOrder}
        isOpen={showCoordinationSheet}
        onClose={() => setShowCoordinationSheet(false)}
        onDurationChange={handleDurationChange}
      />
    </>
  );
}
