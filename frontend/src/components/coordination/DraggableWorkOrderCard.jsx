/**
 * DraggableWorkOrderCard.jsx - TACTICAL VIEW (HOTFIX)
 * 
 * Tarjeta ultra-compacta: 48px altura máxima.
 * - Título: SOLO barrio/dirección (NUNCA availability_note)
 * - Layout: Flex row con items-center
 * - Padding: Mínimo (px-2 py-1)
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
  repair: Wrench,
  install: Wifi,
  pickup: Truck,
  infrastructure: AlertTriangle,
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

  // ========== TÍTULO: BARRIO > DIRECCIÓN > FALLBACK ==========
  // NUNCA mostrar availability_note, notas, u otros campos aquí
  const neighborhood = workOrder.ticket?.neighborhood;
  const address = workOrder.ticket?.address;
  const displayTitle = neighborhood || address || 'Ubicación desconocida';

  // Antigüedad
  const createdAt = workOrder.created_at ? new Date(workOrder.created_at) : null;
  const ageText = createdAt
    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: es })
    : '—';
  
  const daysSinceCreation = createdAt ? differenceInDays(new Date(), createdAt) : 0;
  const isOld = daysSinceCreation > 7;

  // Datos para tooltip
  const clientName = 
    workOrder.ticket?.client_name || 
    workOrder.client_name || 
    'Sin cliente';
  const creatorName = workOrder.ticket?.creator_name || 'Sistema';
  const city = workOrder.ticket?.city || '—';
  const availability = workOrder.ticket?.availability_note || 'Sin preferencia';

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
            {/* CONTENEDOR PRINCIPAL: Altura fija 48px, flex row */}
            <div
              draggable
              onDragStart={handleDragStart}
              className={cn(
                'h-12 rounded border-l-4 transition-all overflow-hidden flex items-center gap-0',
                priorityConfig.borderColor,
                priorityConfig.bgColor,
                'hover:shadow-md',
                isDragging && 'opacity-50 scale-95 shadow-lg'
              )}
            >
              {/* ========== DRAG HANDLE ========== */}
              <div
                className={cn(
                  'flex items-center justify-center px-1 cursor-grab active:cursor-grabbing flex-shrink-0',
                  'border-r border-zinc-700/50 hover:bg-zinc-800/40'
                )}
              >
                <GripVertical
                  size={12}
                  className={cn(
                    'transition-colors',
                    isDragging ? 'text-emerald-400' : 'text-zinc-600'
                  )}
                />
              </div>

              {/* ========== CONTENIDO CENTRAL ========== */}
              <button
                onClick={() => setShowCoordinationSheet(true)}
                className="flex-1 text-left px-2 py-1 hover:bg-zinc-800/20 transition-colors flex flex-col justify-center gap-0.5 min-w-0"
              >
                {/* FILA SUPERIOR: Título (solo una línea, truncado) */}
                <h3 className="font-bold text-xs text-gray-100 truncate leading-tight">
                  {displayTitle}
                </h3>

                {/* FILA INFERIOR: Tipo + Antigüedad + ID */}
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 leading-none">
                  {/* Icono de tipo */}
                  <TypeIcon size={10} className="text-zinc-600 flex-shrink-0" />

                  {/* Antigüedad (con color condicional) */}
                  <span className={cn(
                    'truncate text-[10px]',
                    isOld ? 'text-orange-400 font-semibold' : 'text-zinc-500'
                  )}>
                    {ageText}
                  </span>

                  {/* ID (extremo derecho, antes del badge) */}
                  <span className="text-zinc-600 font-mono text-[10px] ml-auto flex-shrink-0">
                    #{workOrder.id}
                  </span>
                </div>
              </button>

              {/* ========== BADGE DE DURACIÓN (Derecha) ========== */}
              <Badge
                variant="secondary"
                className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0 font-mono flex-shrink-0 mr-1 h-fit"
              >
                {duration}m
              </Badge>
            </div>
          </TooltipTrigger>

          {/* ========== TOOLTIP (HOVER) ========== */}
          <TooltipContent 
            side="right" 
            className="bg-zinc-900 border-zinc-700 text-xs max-w-xs"
          >
            <div className="space-y-1.5">
              <p className="font-semibold text-white">
                OT #{workOrder.id}
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Cliente:</span> {clientName}
              </p>
              <p className="text-zinc-300 text-[11px]">
                <span className="text-zinc-500">Dirección:</span> {address || '—'}
              </p>
              {neighborhood && (
                <p className="text-zinc-300 text-[11px]">
                  <span className="text-zinc-500">Zona:</span> {neighborhood}
                </p>
              )}
              {city !== '—' && (
                <p className="text-zinc-300 text-[11px]">
                  <span className="text-zinc-500">Ciudad:</span> {city}
                </p>
              )}
              {availability && availability !== 'Sin preferencia' && (
                <p className="text-emerald-300 text-[11px] border-t border-zinc-800 pt-1">
                  <span className="text-emerald-500">Disponibilidad:</span> {availability}
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
