/**
 * DraggableWorkOrderCard.jsx - TACTICAL VIEW (COMPACT + RICH TOOLTIP)
 * 
 * Tarjeta compacta: 48px altura.
 * - Título: SOLO barrio/dirección (NUNCA availability_note)
 * - Layout: Flex row con items-center
 * - Padding: Mínimo (px-2 py-1)
 * - Rich Tooltip: Cliente, Dirección, Problema con iconos y estructura
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
  User,
  MapPin,
  FileText,
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

  // ========== DATOS PARA RICH TOOLTIP ==========
  
  // Cliente: Buscar en múltiples campos
  const clientName = 
    workOrder.ticket?.client_name || 
    workOrder.ticket?.connection_details?.client_name ||
    workOrder.client_name || 
    'Cliente Desconocido';

  // Dirección completa
  const fullAddress = address || 'Sin dirección registrada';

  // Descripción del problema (truncada a 100 caracteres)
  const problemDescription = workOrder.ticket?.description || workOrder.ticket?.subject || '';
  const displayDescription = problemDescription.length > 100 
    ? problemDescription.substring(0, 100) + '...'
    : problemDescription;

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

          {/* ========== RICH TOOLTIP ========== */}
          <TooltipContent 
            side="right" 
            className="bg-zinc-950 border border-zinc-800 text-white p-0 rounded-lg shadow-xl"
          >
            <div className="w-80 space-y-3">
              {/* ===== HEADER: CLIENTE ===== */}
              <div className="flex items-start gap-2.5 p-4 border-b border-zinc-800/50">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-700/50 flex-shrink-0">
                  <User size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">
                    Cliente
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {clientName}
                  </p>
                </div>
              </div>

              {/* ===== BODY: DIRECCIÓN ===== */}
              <div className="flex items-start gap-2.5 px-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-900/30 border border-blue-700/50 flex-shrink-0 mt-0.5">
                  <MapPin size={16} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">
                    Dirección
                  </p>
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {fullAddress}
                  </p>
                </div>
              </div>

              {/* ===== FOOTER: PROBLEMA ===== */}
              {displayDescription && (
                <div className="flex items-start gap-2.5 px-4 pb-4 border-t border-zinc-800/50 pt-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-900/30 border border-amber-700/50 flex-shrink-0 mt-0.5">
                    <FileText size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">
                      Problema
                    </p>
                    <p className="text-sm text-zinc-300 line-clamp-2">
                      {displayDescription}
                    </p>
                  </div>
                </div>
              )}

              {/* ===== METADATA: ID Y DURACIÓN ===== */}
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 text-xs">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <span className="text-zinc-500">OT:</span>
                  <span className="font-mono text-emerald-400 font-semibold">#{workOrder.id}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <span className="text-zinc-500">Duración:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{duration}m</span>
                </div>
              </div>
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
