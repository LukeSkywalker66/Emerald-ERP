/**
 * ImprovedCoordinationGrid.jsx
 * Grid de coordinación: Eje X = Tiempo (4-5 horas), Eje Y = Equipos (variable)
 * Drag & drop fluido + redimensionamiento horizontal
 * 4 de febrero de 2026
 */

import React, { useState, useMemo } from 'react';
import { format, addMinutes, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import api from '@/api/client';
import './ImprovedCoordinationGrid.css';

const MORNING_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00'];
const AFTERNOON_SLOTS = ['13:00', '14:00', '15:00', '16:00', '17:00'];

// Convertir slot HH:MM a minutos desde las 00:00
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Minutos desde las 00:00 a HH:MM
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export default function ImprovedCoordinationGrid({
  teams = [],
  workOrders = [],
  currentDate,
  onWorkOrderUpdated,
  onEventClick,
  activeTimeBlock = 'morning',
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [isResizing, setIsResizing] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const slots = activeTimeBlock === 'morning' ? MORNING_SLOTS : AFTERNOON_SLOTS;
  const startSlot = timeToMinutes(slots[0]);
  const endSlot = timeToMinutes(slots[slots.length - 1]) + 60; // +60 para la última hora completa
  const totalMinutes = endSlot - startSlot;

  // Agrupar OTs por equipo y día
  const allocations = useMemo(() => {
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return workOrders.filter((wo) => {
      if (!wo.scheduled_start) return false;
      const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
      return woDay === dayStr;
    });
  }, [workOrders, currentDate]);

  // Para cada equipo, obtener OTs en el rango horario
  function getTeamWorkOrders(teamId) {
    return allocations.filter((wo) => {
      if (wo.team_id !== teamId) return false;

      const woStart = new Date(wo.scheduled_start);
      const woStartMinutes = woStart.getHours() * 60 + woStart.getMinutes();

      // Verificar que esté en el rango del turno activo
      if (woStartMinutes < startSlot) return false;
      if (woStartMinutes >= endSlot) return false;

      return true;
    });
  }

  // Calcular posición y ancho de una OT
  function getWorkOrderPosition(wo) {
    const woStart = new Date(wo.scheduled_start);
    const woStartMinutes = woStart.getHours() * 60 + woStart.getMinutes();
    const offset = woStartMinutes - startSlot;
    const duration = wo.estimated_duration || 60;

    const leftPercent = (offset / totalMinutes) * 100;
    const widthPercent = (duration / totalMinutes) * 100;

    return {
      left: Math.max(0, leftPercent),
      width: Math.max(10, widthPercent), // Mínimo 10% de ancho
      duration,
      offset,
    };
  }

  // Manejar inicio de resize
  function handleResizeStart(e, wo) {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing({
      workOrderId: wo.id,
      startX: e.clientX,
      originalDuration: wo.estimated_duration || 60,
      startTime: new Date(wo.scheduled_start),
    });

    // Listeners globales para move y end
    function handleMouseMove(moveEvent) {
      if (!isResizing) return;

      const delta = moveEvent.clientX - e.clientX;
      const gridWidth = document.querySelector('.improved-grid-container')?.offsetWidth || window.innerWidth * 0.6;
      const pixelsPerMinute = gridWidth / totalMinutes;
      const deltaMinutes = Math.round(delta / pixelsPerMinute);
      const newDuration = Math.max(15, (wo.estimated_duration || 60) + deltaMinutes);

      // Actualizar visualización inmediata
      wo.estimated_duration = newDuration;
    }

    async function handleMouseUp(upEvent) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!isResizing || !wo) {
        setIsResizing(null);
        return;
      }

      try {
        setIsAssigning(true);
        await api.patch(`/v2/work-orders/${wo.id}/assign`, {
          team_id: wo.team_id,
          scheduled_start: wo.scheduled_start,
          estimated_duration: wo.estimated_duration,
        });
        onWorkOrderUpdated?.();
      } catch (err) {
        console.error('Error resizing:', err);
        // Revertir
        wo.estimated_duration = isResizing.originalDuration;
      } finally {
        setIsAssigning(false);
        setIsResizing(null);
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Manejar drag start - NO permitir si se está resizing
  function handleDragStart(e, wo) {
    if (isResizing) {
      e.preventDefault();
      return;
    }

    setDraggedItem(wo);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(wo));
  }

  // Manejar drop en celda
  async function handleDrop(e, teamId, slotStartTime) {
    e.preventDefault();
    
    if (isResizing) {
      setDraggedItem(null);
      return;
    }

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const wo = JSON.parse(data);

    try {
      setIsAssigning(true);
      const newScheduledStart = new Date(currentDate);
      const [hours, minutes] = slotStartTime.split(':').map(Number);
      newScheduledStart.setHours(hours, minutes, 0, 0);

      await api.patch(`/v2/work-orders/${wo.id}/assign`, {
        team_id: teamId,
        scheduled_start: newScheduledStart.toISOString(),
        estimated_duration: wo.estimated_duration || 60,
      });

      onWorkOrderUpdated?.();
    } catch (err) {
      console.error('Error dropping:', err);
    } finally {
      setIsAssigning(false);
      setDraggedItem(null);
    }
  }

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900/50">
        <p className="text-zinc-400">No hay equipos disponibles</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900/20 overflow-hidden">
      {/* HEADER CON HORARIOS */}
      <div className="flex-shrink-0 bg-zinc-900 border-b border-zinc-700">
        <div className="flex">
          {/* Espaciador para nombres de equipos */}
          <div className="w-40 flex-shrink-0 px-3 py-3 border-r border-zinc-700">
            <p className="text-xs font-bold text-zinc-400">EQUIPOS</p>
          </div>

          {/* Timeline de horas */}
          <div className="flex-1 flex overflow-hidden">
            {slots.map((slot, idx) => {
              const isLastSlot = idx === slots.length - 1;
              return (
                <div
                  key={slot}
                  className={`flex-1 px-2 py-3 border-r border-zinc-700 text-center min-w-0 ${
                    isLastSlot ? 'border-r-0' : ''
                  }`}
                >
                  <p className="text-sm font-bold text-emerald-400">{slot}</p>
                  <p className="text-xs text-zinc-500">60 min</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* GRID DE EQUIPOS Y TAREAS */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-zinc-700/50">
          {teams.map((team) => {
            const teamWOs = getTeamWorkOrders(team.id);

            return (
              <div key={team.id} className="flex min-h-20 hover:bg-zinc-800/30 transition-colors group">
                {/* Nombre del equipo */}
                <div className="w-40 flex-shrink-0 px-3 py-2 border-r border-zinc-700 bg-zinc-900/50 flex flex-col justify-center">
                  <p className="text-sm font-bold text-white truncate">{team.name}</p>
                  <p className="text-xs text-zinc-400">{team.members?.length || 0} técnicos</p>
                </div>

                {/* Grid de horas */}
                <div className="flex-1 flex relative improved-grid-container">
                  {slots.map((slot, slotIdx) => {
                    const isLastSlot = slotIdx === slots.length - 1;
                    return (
                      <div
                        key={`${team.id}-${slot}`}
                        className={`flex-1 border-r border-zinc-700/30 p-2 relative min-h-20 ${
                          isLastSlot ? 'border-r-0' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => handleDrop(e, team.id, slot)}
                      >
                        {/* Línea sutil de separación */}
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-700/10" />
                      </div>
                    );
                  })}

                  {/* OTs del equipo renderizadas sobre el grid */}
                  <div className="absolute inset-0 p-2 pointer-events-none">
                    {teamWOs.map((wo) => {
                      const pos = getWorkOrderPosition(wo);
                      return (
                        <div
                          key={wo.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, wo)}
                          onClick={() => onEventClick?.(wo)}
                          className="absolute top-2 h-16 bg-amber-600/80 rounded border border-amber-500/50 hover:bg-amber-700 cursor-move transition-all pointer-events-auto group/task overflow-hidden"
                          style={{
                            left: `calc(${pos.left}% + 0.5rem)`,
                            width: `calc(${pos.width}% - 1rem)`,
                          }}
                        >
                          {/* Contenido */}
                          <div className="p-1.5 h-full flex flex-col text-xs text-white overflow-hidden">
                            <p className="font-bold truncate">{wo.client_name || 'S/N'}</p>
                            <p className="truncate opacity-80 text-xs">{wo.address || '—'}</p>
                            <p className="mt-auto text-xs opacity-75">OT #{wo.id}</p>
                          </div>

                          {/* Asa de redimensionamiento - DERECHA */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, wo)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500 hover:bg-emerald-400 cursor-col-resize opacity-0 group-hover/task:opacity-100 transition-opacity"
                            title="Arrastrar para cambiar duración"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading overlay */}
      {isAssigning && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="bg-zinc-900 px-4 py-2 rounded border border-emerald-600">
            <p className="text-sm text-emerald-400">Actualizando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
