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
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-950/40',
    textColor: 'text-red-300',
    badgeClass: 'bg-red-600 text-red-100',
  },
  high: {
    label: 'Alta',
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-950/40',
    textColor: 'text-orange-300',
    badgeClass: 'bg-orange-600 text-orange-100',
  },
  medium: {
    label: 'Media',
    borderColor: 'border-l-emerald-600',
    bgColor: 'bg-zinc-900',
    textColor: 'text-emerald-300',
    badgeClass: 'bg-emerald-600 text-emerald-100',
  },
  low: {
    label: 'Baja',
    borderColor: 'border-l-emerald-600',
    bgColor: 'bg-zinc-900',
    textColor: 'text-emerald-300',
    badgeClass: 'bg-emerald-600 text-emerald-100',
  },
};

export default function DraggableWorkOrderCard({
  workOrder,
  onQuickAction,
  isDragging = false,
}) {
  const [showCoordinationSheet, setShowCoordinationSheet] = useState(false);
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
      {/* TARJETA COMPACTA REDISEÑADA */}
      <div
        draggable
        onDragStart={handleDragStart}
        className={cn(
          'rounded border-l-4 transition-all overflow-hidden',
          priorityConfig.borderColor,
          priorityConfig.bgColor,
          isDragging && 'opacity-50 scale-95 shadow-lg'
        )}
      >
        <div className="flex gap-0">
          {/* DRAG HANDLE (izquierda) */}
          <div
            className={cn(
              'flex items-center justify-center py-2 px-1.5 cursor-grab active:cursor-grabbing flex-shrink-0',
              'border-r border-zinc-700/50 hover:bg-zinc-800/40'
            )}
          >
            <GripVertical
              size={14}
              className={cn(
                'transition-colors',
                isDragging ? 'text-emerald-400' : 'text-zinc-600'
              )}
            />
          </div>

          {/* CONTENIDO (clickeable) */}
          <button
            onClick={() => setShowCoordinationSheet(true)}
            className="flex-1 text-left p-2 hover:bg-zinc-800/20 transition-colors"
          >
            {/* Header: ID + Prioridad */}
            <div className="flex items-center justify-between mb-1 gap-1.5">
              <span className="text-xs font-bold text-white">OT #{workOrder.id}</span>
              <Badge className={`text-[10px] font-semibold px-1.5 py-0 ${priorityConfig.badgeClass}`}>
                {priorityConfig.label}
              </Badge>
            </div>

            {/* Dirección (truncada) */}
            <p className="text-xs text-zinc-300 truncate font-medium mb-1">
              {workOrder.ticket?.address || 'Sin dirección'}
            </p>

            {/* Cliente */}
            {(workOrder.ticket?.client_name || workOrder.client_name) && (
              <div className="flex items-center gap-1 mb-1 text-[11px] text-zinc-400">
                <User size={10} />
                <span className="truncate">
                  {workOrder.ticket?.client_name || workOrder.client_name}
                </span>
              </div>
            )}

            {/* Footer: Antigüedad + Duración */}
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span className="truncate">📅 {ageText}</span>
              <Badge
                variant="secondary"
                className="bg-zinc-700/50 text-zinc-300 text-[10px] font-mono px-1.5 py-0"
              >
                <Clock size={8} className="mr-0.5" />
                {duration}m
              </Badge>
            </div>

            {/* Indicadores especiales */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {workOrder.ticket?.availability_note && (
                <div className="flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded">
                  <Clock size={8} />
                  <span>Disp.</span>
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
