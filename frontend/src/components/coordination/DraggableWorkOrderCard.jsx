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
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  GripVertical,
  Wrench,
  Wifi,
  Truck,
  AlertTriangle,
  Package,
  ArrowUpFromLine,
  Building2,
  User,
  MapPin,
  MapPinOff,
  FileText,
  Clock,
  Tag,
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
    bgColor: 'bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-900',
  },
  high: {
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-900',
  },
  medium: {
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-900',
  },
  low: {
    borderColor: 'border-l-zinc-600',
    bgColor: 'bg-zinc-900',
  },
};

// ========== CONFIGURACIÓN DE TIPO (fallback si no hay DB) ==========

const FALLBACK_TYPE_ICONS = {
  repair: Wrench,
  install: Wifi,
  pickup: Truck,
  infrastructure: AlertTriangle,
};

const FALLBACK_TYPE_LABELS = {
  repair: 'Reparación',
  install: 'Instalación',
  pickup: 'Retiro',
  infrastructure: 'Infraestructura',
  incident: 'Incidente',
};

/** Mapa de nombre de icono (string) → componente lucide-react */
const ICON_MAP = {
  Wrench,
  Wifi,
  Truck,
  AlertTriangle,
  Package,
  ArrowUpFromLine,
  Building2,
};

// ========== COMPONENTE PRINCIPAL ==========

export default function DraggableWorkOrderCard({
  workOrder,
  currentDate,
  onQuickAction,
  isDragging = false,
  workOrderTypeMap = {},
}) {
  const [showCoordinationSheet, setShowCoordinationSheet] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationRefreshKey, setLocationRefreshKey] = useState(0);
  const [duration, setDuration] = useState(workOrder?.estimated_duration || 60);

  // ========== DATOS DERIVADOS ==========

  // Prioridad: usar la propia de la OT primero, fallback a la del ticket
  const priority = workOrder.priority || workOrder.ticket?.priority || 'low';
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;

  // Tipo de OT (icono) — desde DB si disponible, fallback a hardcode
  const otType = workOrder.ot_type || 'repair';
  const typeConfig = workOrderTypeMap[otType];
  const iconName = typeConfig?.icon;
  const TypeIcon = (iconName && ICON_MAP[iconName]) || FALLBACK_TYPE_ICONS[otType] || Wrench;

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

  // Tipo de OT (label) — desde DB si disponible, fallback a hardcode
  const otTypeLabel = typeConfig?.name || FALLBACK_TYPE_LABELS[otType] || 'Otro';

  // Fecha de creación formateada
  const createdDate = createdAt 
    ? format(createdAt, "dd/MM/yyyy HH:mm", { locale: es })
    : 'Sin fecha';

  // ========== HANDLERS ==========

  const handleDragStart = (e) => {
    // Prevenir drag si OT está completada
    if (workOrder.status === 'completed') {
      e.preventDefault();
      return;
    }
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
            {/* CONTENEDOR PRINCIPAL: Tactical HUD */}
            <div
              draggable={workOrder.status !== 'completed'}
              onDragStart={handleDragStart}
              className={cn(
                'min-h-[56px] rounded border-l-4 transition-all overflow-hidden flex items-center gap-0 group',
                priorityConfig.borderColor,
                priorityConfig.bgColor,
                workOrder.status === 'completed' && 'opacity-40 cursor-not-allowed border-l-red-600 bg-red-950/10',
                workOrder.status !== 'completed' && 'hover:shadow-lg hover:translate-x-1 hover:brightness-125',
                isDragging && 'opacity-50 scale-95 shadow-lg'
              )}
            >
              {/* ========== DRAG HANDLE ========== */}
              <div
                className={cn(
                  'flex items-center justify-center w-5 flex-shrink-0',
                  'border-r border-zinc-800/70 bg-zinc-900/40',
                  workOrder.status === 'completed' ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                )}
              >
                <GripVertical
                  size={12}
                  className={cn(
                    'transition-colors',
                    isDragging ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'
                  )}
                />
              </div>

              {/* ========== CONTENIDO CENTRAL ========== */}
              <button
                onClick={() => setShowCoordinationSheet(true)}
                className="flex-1 text-left px-2.5 py-1.5 hover:bg-zinc-800/20 transition-colors flex flex-col justify-center gap-0.5 min-w-0"
              >
                {/* FILA SUPERIOR: Nombre cliente + Título + warning ubicación */}
                <div className="flex items-start gap-1 min-w-0">
                  {(!workOrder.latitude || !workOrder.longitude) && (
                    <MapPinOff
                      size={10}
                      className="flex-shrink-0 text-amber-400/90 mt-0.5"
                      title="Sin ubicación cargada"
                    />
                  )}
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] text-zinc-400 truncate leading-tight">
                      {clientName}
                    </span>
                    <h3 className="font-bold text-xs text-gray-100 truncate leading-tight min-w-0">
                      {displayTitle}
                    </h3>
                  </div>
                </div>

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
                  <span className="text-zinc-500/60 font-mono text-[10px] ml-auto flex-shrink-0 tracking-wider">
                    #{workOrder.id}
                  </span>
                </div>
              </button>

              {/* ========== BADGE DE DURACIÓN (Derecha) ========== */}
              <Badge
                variant="secondary"
                className="bg-zinc-800/80 text-zinc-300 text-[10px] px-2 py-0.5 font-mono tracking-wider border border-zinc-700 flex-shrink-0 mr-2 h-fit"
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

              {/* ===== METADATA: TIPO, FECHA Y DURACIÓN ===== */}
              <div className="px-4 pb-4 space-y-2">
                {/* Fila 1: Tipo */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <Tag size={14} className="text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-500">Tipo:</span>
                  <span className="font-semibold text-emerald-400 ml-auto">{otTypeLabel}</span>
                </div>
                
                {/* Fila 2: Fecha y Duración */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <Clock size={12} className="text-zinc-500 flex-shrink-0" />
                    <span className="font-mono text-zinc-300 text-[10px] truncate">{createdDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 justify-center">
                    <span className="text-zinc-500 text-[10px]">⏱</span>
                    <span className="font-mono text-emerald-400 font-semibold text-xs">{duration}min</span>
                  </div>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* ========== COORDINATION SHEET ========== */}
      <CoordinationSheet
        workOrder={workOrder}
        currentDate={currentDate}
        isOpen={showCoordinationSheet}
        onClose={() => setShowCoordinationSheet(false)}
        onDurationChange={handleDurationChange}
        onWorkOrderUpdated={() => onQuickAction?.('work_order_updated', workOrder)}
        onOpenLocationModal={() => setShowLocationModal(true)}
        onCloseLocationModal={() => setShowLocationModal(false)}
        onLocationSaved={() => {
          setLocationRefreshKey(k => k + 1);
          setShowLocationModal(false);
        }}
        refreshKey={locationRefreshKey}
        locationModalOpen={showLocationModal}
      />
    </>
  );
}
