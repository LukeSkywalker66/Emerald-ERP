/**
 * CoordinationGridPage.jsx
 * "The Grid" - Despacho de cuadrillas con Drag & Drop
 * 3 de febrero de 2026
 */

import React, { useState, useEffect, useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader,
  RotateCcw,
  Wrench,
  Home,
  Package,
  MapPin,
  Clock,
  X,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';
import { useNavigate } from 'react-router-dom';

// ========== CONSTANTES ==========

const OT_TYPE_CONFIG = {
  repair: { label: 'Reparación', icon: Wrench, color: 'bg-amber-600/80' },
  install: { label: 'Instalación', icon: Home, color: 'bg-emerald-600/80' },
  pickup: { label: 'Retiro', icon: Package, color: 'bg-blue-600/80' },
  infrastructure: { label: 'Infraestructura', icon: Wrench, color: 'bg-purple-600/80' },
};

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
];

// ========== HELPERS ==========

function simulateCollisionCheck(allocations, teamId, timeSlot, estimatedDuration = 60) {
  const [hours, minutes] = timeSlot.split(':');
  const slotStart = parseInt(hours) * 60 + parseInt(minutes);
  const slotEnd = slotStart + estimatedDuration;

  return allocations.some((wo) => {
    if (wo.team_id !== teamId) return false;
    
    const woStart = new Date(wo.scheduled_start);
    const woEnd = new Date(wo.scheduled_end || wo.scheduled_start);
    const woStartMinutes = woStart.getHours() * 60 + woStart.getMinutes();
    const woEndMinutes = woEnd.getHours() * 60 + woEnd.getMinutes();

    return slotStart < woEndMinutes && slotEnd > woStartMinutes;
  });
}

// ========== COMPONENTES ==========

function BacklogCard({ workOrder, isDragging, onDragStart }) {
  const typeConfig = OT_TYPE_CONFIG[workOrder.ot_type] || OT_TYPE_CONFIG.repair;
  const TypeIcon = typeConfig.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify(workOrder));
        if (onDragStart) {
          onDragStart(workOrder);
        }
      }}
      className={`
        p-3 rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing
        transition-all ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        ${typeConfig.color} hover:shadow-lg hover:shadow-emerald-500/30
      `}
    >
      <div className="flex items-start gap-2">
        <TypeIcon size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{workOrder.client_name || 'S/N'}</p>
          <p className="text-xs opacity-90 truncate">{workOrder.address || '—'}</p>
          {workOrder.scheduled_start && (
            <p className="text-xs mt-1 opacity-75">
              📅 {format(new Date(workOrder.scheduled_start), 'HH:mm')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs opacity-75">OT #{workOrder.id} • {workOrder.estimated_duration}min</div>
    </div>
  );
}

function GridCard({ workOrder, onDelete, onDetail, hasCollision }) {
  const typeConfig = OT_TYPE_CONFIG[workOrder.ot_type] || OT_TYPE_CONFIG.repair;

  return (
    <div
      onClick={() => onDetail(workOrder)}
      className={`
        p-2 rounded border-2 cursor-pointer
        transition-all group
        ${hasCollision ? 'border-red-500/80 bg-red-950/40 ring-2 ring-red-500/30' : `border-zinc-700/50 ${typeConfig.color}`}
      `}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate leading-tight">{workOrder.client_name || 'S/N'}</p>
          <p className="text-xs opacity-90 truncate leading-tight">OT #{workOrder.id}</p>
        </div>
        {hasCollision && <AlertTriangle size={12} className="text-red-400" />}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(workOrder.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/30 rounded"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function GridCell({ teamId, timeSlot, workOrders, onDrop, onDetail, onDeleteCard, draggedItem }) {
  const isOverlapping = workOrders.length > 1;
  
  let wouldCollide = false;
  if (draggedItem) {
    wouldCollide = simulateCollisionCheck(workOrders, teamId, timeSlot, draggedItem.estimated_duration || 60);
  }

  return (
    <div
      className={`
        min-h-14 p-2 border rounded transition-all space-y-1
        ${wouldCollide ? 'bg-red-900/30 border-red-500/50' : 'bg-zinc-900/20 border-zinc-700/30'}
      `}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/json');
        if (data) {
          const payload = JSON.parse(data);
          onDrop(teamId, timeSlot, payload);
        }
      }}
    >
      {workOrders.map((wo) => (
        <GridCard
          key={wo.id}
          workOrder={wo}
          onDetail={onDetail}
          onDeleteCard={onDeleteCard}
          onDelete={onDeleteCard}
          hasCollision={isOverlapping}
        />
      ))}

      {wouldCollide && !workOrders.length && (
        <div className="text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle size={12} />
          Conflicto
        </div>
      )}
    </div>
  );
}

function DetailSheet({ workOrder, isOpen, onClose, onUnassign, onNavigate }) {
  if (!isOpen || !workOrder) return null;

  const typeConfig = OT_TYPE_CONFIG[workOrder.ot_type] || OT_TYPE_CONFIG.repair;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-screen w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
          <div>
            <h2 className="font-bold text-white">OT #{workOrder.id}</h2>
            <p className="text-xs text-zinc-400">Ticket #{workOrder.ticket_id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Tipo</p>
            <Badge className={`${typeConfig.color} border-0`}>{typeConfig.label}</Badge>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="text-sm font-medium text-white">{workOrder.client_name || 'N/A'}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-zinc-500" />
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Dirección</p>
            </div>
            <p className="text-sm text-zinc-300">{workOrder.address || 'N/A'}</p>
          </div>

          {workOrder.scheduled_start && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-zinc-500" />
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Programado</p>
              </div>
              <div className="text-sm text-zinc-300 space-y-1">
                <p>Inicio: {format(new Date(workOrder.scheduled_start), 'dd MMM yyyy HH:mm', { locale: es })}</p>
                {workOrder.scheduled_end && (
                  <p>Fin: {format(new Date(workOrder.scheduled_end), 'HH:mm', { locale: es })}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/80 p-4 space-y-2">
          <Button
            onClick={() => {
              onUnassign(workOrder.id);
              onClose();
            }}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            Devolver al Backlog
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== PÁGINA PRINCIPAL ==========

export default function CoordinationGridPage() {
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [gridData, setGridData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState(null);

  useEffect(() => {
    loadCoordinationGrid();
  }, [currentDate]);

  const loadCoordinationGrid = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Grid solo por HOY (no por semana)
      const startDateStr = format(currentDate, 'yyyy-MM-dd');
      const endDateStr = format(currentDate, 'yyyy-MM-dd');

      console.log('📊 Cargando grid para:', startDateStr);
      const { data } = await api.get('/v2/work-orders/coordination/grid', {
        params: { start_date: startDateStr, end_date: endDateStr },
      });

      console.log('✅ Grid cargado:', data);
      setGridData(data);
    } catch (err) {
      console.error('Error loading grid:', err);
      setError(err.message || 'Error al cargar el grid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropOnGrid = async (teamId, timeSlot, workOrder) => {
    try {
      setIsAssigning(true);
      setAssignmentError(null);

      const estimatedDuration = workOrder.estimated_duration || 60;
      const hasCollision = simulateCollisionCheck(gridData.allocations, teamId, timeSlot, estimatedDuration);

      if (hasCollision) {
        console.warn('⚠️ Colisión detectada!');
        setAssignmentError('❌ Conflicto de horarios');
        return;
      }

      const [hours, minutes] = timeSlot.split(':');
      const scheduledStart = new Date(currentDate);
      scheduledStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      console.log('🔄 Asignando OT:', {
        workOrderId: workOrder.id,
        teamId,
        timeSlot,
        scheduledStart: scheduledStart.toISOString(),
        estimatedDuration,
      });

      const response = await api.patch(`/v2/work-orders/${workOrder.id}/assign`, {
        team_id: teamId,
        scheduled_start: scheduledStart.toISOString(),
        estimated_duration: estimatedDuration,
      });

      console.log('✅ Asignación exitosa:', response.data);
      await loadCoordinationGrid();
    } catch (err) {
      console.error('❌ Error en asignación:', err);
      setAssignmentError(err.response?.data?.detail || 'Error al asignar');
    } finally {
      setIsAssigning(false);
      setDraggedItem(null);
    }
  };

  const handleUnassignWorkOrder = async (workOrderId) => {
    try {
      setIsAssigning(true);
      await api.patch(`/v2/work-orders/${workOrderId}/unassign`);
      await loadCoordinationGrid();
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Grid solo para HOY (no para la semana)
  const weekDays = useMemo(() => {
    return [currentDate];
  }, [currentDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader size={32} className="animate-spin text-emerald-400" />
          <p className="text-zinc-400">Cargando "The Grid"...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">📱 Coordinación de Tareas</h1>
            <p className="text-xs text-zinc-400">Despacho por móvil • Hoy: {format(currentDate, 'dd MMM yyyy', { locale: es })}</p>
          </div>
          <Button onClick={() => loadCoordinationGrid()} disabled={isLoading} variant="outline" size="sm">
            <RotateCcw size={16} />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button onClick={() => setCurrentDate(addDays(currentDate, -1))} variant="ghost" size="sm">
            <ChevronLeft size={18} /> Anterior
          </Button>
          <Button
            onClick={() => setCurrentDate(new Date())}
            variant="outline"
            size="sm"
            className="border-emerald-600 text-emerald-400"
          >
            Hoy
          </Button>
          <Button onClick={() => setCurrentDate(addDays(currentDate, 1))} variant="ghost" size="sm">
            Siguiente <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Errores */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-red-900/50 bg-red-950/30 flex items-center gap-2 text-red-300 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {assignmentError && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-amber-900/50 bg-amber-950/30 flex items-center gap-2 text-amber-300 text-sm">
          <AlertTriangle size={16} />
          {assignmentError}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-1/5 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto p-4 space-y-4">
          {/* Carga */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">📊 Carga</p>
            
            {gridData?.team_load?.map((load) => {
              const utilColor = 
                load.utilization_percentage > 90 ? 'bg-red-600' :
                load.utilization_percentage > 70 ? 'bg-amber-600' :
                'bg-emerald-600';
              
              return (
                <div key={load.team_id} className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium">{load.team_name}</p>
                    <span className="text-xs text-zinc-400">{load.assigned_ots_count}</span>
                  </div>
                  
                  <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${utilColor} transition-all`}
                      style={{ width: `${load.utilization_percentage}%` }}
                    />
                  </div>
                  
                  <p className="text-xs text-zinc-400 mt-1">{load.utilization_percentage}%</p>
                </div>
              );
            })}
          </div>

          <hr className="border-zinc-700/50" />

          {/* Backlog */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">📋 Backlog</p>
          </div>

          <div className="space-y-2">
            {gridData?.backlog?.map((wo) => (
              <BacklogCard
                key={wo.id}
                workOrder={wo}
                isDragging={draggedItem?.id === wo.id}
                onDragStart={setDraggedItem}
              />
            ))}

            {!gridData?.backlog?.length && (
              <div className="p-4 rounded-lg border border-dashed border-zinc-700 text-center">
                <CheckCircle size={20} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-xs text-zinc-500">✨ Sin tareas</p>
              </div>
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full border-collapse">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
              <div className="flex">
                <div className="w-32 p-3 border-r border-zinc-800 flex-shrink-0">
                  <p className="text-xs text-zinc-500">Teams</p>
                </div>
                <div className="flex-1 flex">
                  {weekDays.map((day) => (
                    <div key={day.toString()} className="flex-1 p-3 border-r border-zinc-700/50 text-center">
                      <p className="text-xs font-bold text-emerald-400">{format(day, 'EEEE', { locale: es }).toUpperCase()}</p>
                      <p className="text-sm text-white">{format(day, 'dd MMMM yyyy', { locale: es })}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="divide-y divide-zinc-800">
              {gridData?.teams?.map((team) => (
                <div key={team.id} className="flex min-h-96">
                  <div className="w-32 p-3 border-r border-zinc-800 bg-zinc-900/50 flex-shrink-0">
                    <p className="text-xs font-bold">{team.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{team.members?.length} técnicos</p>
                  </div>

                  <div className="flex-1 flex divide-x divide-zinc-700/50">
                    {weekDays.map((day) => (
                      <div key={day.toString()} className="flex-1 divide-y divide-zinc-700/30">
                        {TIME_SLOTS.map((slot) => {
                          const dayStr = format(day, 'yyyy-MM-dd');
                          const cellKey = `${dayStr}_${team.id}_${slot}`;
                          const workOrdersInCell = gridData.allocations.filter((wo) => {
                            if (wo.team_id !== team.id) return false;
                            if (!wo.scheduled_start) return false;
                            const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
                            const woHour = format(new Date(wo.scheduled_start), 'HH');
                            const slotMatch = woDay === dayStr && woHour === slot.split(':')[0];
                            if (slotMatch) {
                              console.log('✅ OT encontrada en slot:', { woId: wo.id, team: team.name, slot, woStart: wo.scheduled_start });
                            }
                            return slotMatch;
                          });

                          return (
                            <GridCell
                              key={cellKey}
                              teamId={team.id}
                              timeSlot={slot}
                              workOrders={workOrdersInCell}
                              onDrop={handleDropOnGrid}
                              onDetail={(wo) => {
                                setSelectedWorkOrder(wo);
                                setIsDetailOpen(true);
                              }}
                              onDeleteCard={handleUnassignWorkOrder}
                              draggedItem={draggedItem}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      <DetailSheet
        workOrder={selectedWorkOrder}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedWorkOrder(null);
        }}
        onUnassign={handleUnassignWorkOrder}
        onNavigate={navigate}
      />

      {/* Loading */}
      {isAssigning && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader size={32} className="animate-spin text-emerald-400" />
            <p className="text-white text-sm">Asignando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
