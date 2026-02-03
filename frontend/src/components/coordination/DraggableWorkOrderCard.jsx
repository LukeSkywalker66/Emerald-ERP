/**
 * DraggableWorkOrderCard.jsx
 * 
 * Tarjeta compacta de OT para arrastrar desde el Sidebar.
 * Muestra: ID, Prioridad, Dirección, Antigüedad.
 */

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_CONFIG = {
  critical: {
    label: 'Crítica',
    color: 'border-l-4 border-red-600 bg-red-950/20',
    textColor: 'text-red-300',
    badgeClass: 'bg-red-600 text-red-100',
  },
  high: {
    label: 'Alta',
    color: 'border-l-4 border-orange-600 bg-orange-950/20',
    textColor: 'text-orange-300',
    badgeClass: 'bg-orange-600 text-orange-100',
  },
  medium: {
    label: 'Media',
    color: 'border-l-4 border-amber-600 bg-amber-950/20',
    textColor: 'text-amber-300',
    badgeClass: 'bg-amber-600 text-amber-100',
  },
  low: {
    label: 'Baja',
    color: 'border-l-4 border-emerald-600 bg-emerald-950/20',
    textColor: 'text-emerald-300',
    badgeClass: 'bg-emerald-600 text-emerald-100',
  },
};

export default function DraggableWorkOrderCard({
  workOrder,
  onQuickAction,
  isDragging = false,
}) {
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  
  const priority = workOrder.ticket?.priority || 'low';
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;

  // Calcular antigüedad (validar fecha)
  const createdAt = workOrder.created_at ? new Date(workOrder.created_at) : null;
  const ageText = createdAt 
    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: es })
    : 'Fecha desconocida';

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(workOrder));
    e.dataTransfer.setData('workOrderId', workOrder.id);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'p-3 rounded-lg transition-all cursor-grab active:cursor-grabbing',
        priorityConfig.color,
        isDragging && 'opacity-50 scale-95 shadow-lg'
      )}
      onMouseEnter={() => setShowQuickMenu(true)}
      onMouseLeave={() => setShowQuickMenu(false)}
    >
      {/* Header: ID + Prioridad */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white">OT #{workOrder.id}</span>
        <Badge className={`text-xs font-semibold ${priorityConfig.badgeClass}`}>
          {priorityConfig.label}
        </Badge>
      </div>

      {/* Dirección */}
      <div className="mb-2">
        <p className="text-xs text-zinc-300 line-clamp-2">
          {workOrder.ticket?.address || 'Sin dirección'}
        </p>
      </div>

      {/* Cliente */}
      {workOrder.ticket?.client_name && (
        <div className="flex items-center gap-1 mb-2 text-xs text-zinc-400">
          <User size={12} />
          <span className="truncate">{workOrder.ticket.client_name}</span>
        </div>
      )}

      {/* Antigüedad + Duración estimada */}
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
        <span>📅 {ageText}</span>
        <span className="text-zinc-600">{workOrder.estimated_duration || 60}m</span>
      </div>

      {/* Quick Actions (hover) */}
      {showQuickMenu && (
        <div className="pt-2 border-t border-zinc-700/50 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-amber-400 hover:bg-amber-900/30 flex-1"
            onClick={(e) => {
              e.stopPropagation();
              if (onQuickAction) {
                onQuickAction(workOrder.id, 'no-answer');
              }
              setShowQuickMenu(false);
            }}
          >
            <Phone size={12} className="mr-1" />
            No contesta
          </Button>
        </div>
      )}
    </div>
  );
}
