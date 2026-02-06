/**
 * DraggableWorkOrderCard.jsx - TACTICAL VIEW
 * 
 * Tarjeta ultra-compacta orientada a ruteo y coordinación táctica.
 * Altura máxima: 68px | Color semáforo por prioridad | Sin texto redundante.
 * 
 * Jerarquía visual:
 * - Fila superior: Barrio/Dirección + Duración
 * - Fila inferior: Tipo + Antigüedad + ID
 * - Tooltip: Info completa al hover
 */

import React, { useState } from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  GripVertical,
  Wrench,
  Wifi,
  Truck,
  AlertTriangle,
  Package,
  Home,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import CoordinationSheet from './CoordinationSheet';

// ========== CONFIGURACIÓN DE PRIORIDAD (SEMÁFORO) ==========

const PRIORITY_CONFIG = {
  critical: {
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-950/20',
  },
  high: {
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-950/20',
  },
  medium: {
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-950/15',
  },
  low: {
    borderColor: 'border-l-zinc-600',
    bgColor: 'bg-zinc-900',
  },
};

// ========== CONFIGURACIÓN DE TIPO ==========

const TYPE_ICONS = {
  installation: Wifi,
  repair: Wrench,
  relocation: Truck,
  pickup: Package,
  infrastructure: AlertTriangle,
  administrative: Home,
};

// ========== COMPONENTE PRINCIPAL ==========

export default function DraggableWorkOrderCard({
  workOrder,
  onQuickAction,
  isDragging = false,
}) {
  const [showCoordinationSheet, setShowCoordinationSheet] = useState(false);
  const [duration, setDuration] = useState(workOrder?.estimated_duration || 60);

  // ========== DATOS DERIVADOS ==========

  const priority = workOrder.ticket?.priority || 'low';
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;

  // Tipo de OT (icono)
  const otType = workOrder.ot_type || 'repair';
  const TypeIcon = TYPE_ICONS[otType] || Wrench;

  // Título: Barrio > Dirección truncada
  const neighborhood = workOrder.ticket?.neighborhood;
  const address = workOrder.address || workOrder.ticket?.availability_note || 'Sin dirección';
  const displayTitle = neighborhood || address;

  // Antigüedad
  const createdAt = workOrder.created_at ? new Date(workOrder.created_at) : null;
  const ageText = createdAt
    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: es })
    : '—';
  
  const daysSinceCreation = createdAt ? differenceInDays(new Date(), createdAt) : 0;
  const isOld = daysSinceCreation > 7;

  // Datos para tooltip
  const clientName = workOrder.ticket?.contact_info?.client_name || 
                     workOrder.ticket?.client_name || 
                     workOrder.client_name || 
                     'Sin cliente';
  const creatorName = workOrder.ticket?.creator_name || 'Sistema';
  const city = workOrder.ticket?.contact_info?.city || workOrder.ticket?.city || '—';

  // ========== HANDLERS ==========

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(workOrder));
    e.dataTransfer.setData('workOrderId', workOrder.id.toString());
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
  };

  // ========== RENDER ==========

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              draggable
              onDragStart={handleDragStart}
              className={cn(
                'h-[68px] rounded border-l-4 transition-all overflow-hidden',
                priorityConfig.borderColor,
                priorityConfig.bgColor,
                'hover:shadow-md hover:shadow-emerald-500/10',
                isDragging && 'opacity-50 scale-95 shadow-lg'
              )}
            >
              <div className="flex gap-0 h-full">
                {/* ========== DRAG HANDLE ========== */}
                <div
                  className={cn(
                    'flex items-center justify-center px-1.5 cursor-grab active:cursor-grabbing flex-shrink-0',
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

                {/* ========== CONTENIDO ========== */}
                <button
                  onClick={() => setShowCoordinationSheet(true)}
                  className="flex-1 text-left px-2.5 py-2 hover:bg-zinc-800/20 transition-colors flex flex-col justify-between"
                >
                  {/* FILA SUPERIOR: Título + Duración */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-gray-100 truncate flex-1">
                      {displayTitle}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 font-mono flex-shrink-0"
                    >
                      {duration}m
                    </Badge>
                  </div>

                  {/* FILA INFERIOR: Tipo + Antigüedad + ID */}
                  <div className="flex items-center gap-2 text-xs">
                    {/* Icono de tipo */}
                    <TypeIcon size={12} className="text-zinc-500 flex-shrink-0" />

                    {/* Antigüedad (con color condicional) */}
                    <span className={cn(
                      'truncate',
                      isOld ? 'text-orange-400 font-semibold' : 'text-zinc-500'
                    )}>
                      {ageText}
                    </span>

                    {/* ID */}
                    <span className="text-zinc-600 ml-auto font-mono">
                      #{workOrder.id}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </TooltipTrigger>

          {/* ========== TOOLTIP (HOVER) ========== */}
          <TooltipContent 
            side="right" 
            className="bg-zinc-900 border-zinc-700 text-xs max-w-xs"
          >
            <div className="space-y-1">
              <p className="font-semibold text-white">
                OT #{workOrder.id}
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Cliente:</span> {clientName}
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Dirección:</span> {address}
              </p>
              {neighborhood && (
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Zona:</span> {neighborhood}
                </p>
              )}
              {city !== '—' && (
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Ciudad:</span> {city}
                </p>
              )}
              <p className="text-zinc-400 text-[10px] pt-1 border-t border-zinc-800">
                Creado por: {creatorName}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* ========== COORDINATION SHEET ========== */}
      <CoordinationSheet
        workOrder={workOrder}
        isOpen={showCoordinationSheet}
        onClose={() => setShowCoordinationSheet(false)}
        onDurationChange={handleDurationChange}
      />
    </>
  );
}
