/**
 * ImprovedCoordinationGrid.jsx
 * Grid de coordinación: Eje X = Tiempo (4-5 horas), Eje Y = Equipos (variable)
 * Drag & drop fluido + redimensionamiento horizontal
 * 4 de febrero de 2026
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
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

// Identificador robusto de OT (compatibilidad con distintas formas de ID)
function getWorkOrderId(item) {
  return item?.id ?? item?.work_order_id ?? item?.workOrderId ?? null;
}

function isSameWorkOrder(a, b) {
  const aId = getWorkOrderId(a);
  const bId = getWorkOrderId(b);
  if (aId != null && bId != null && String(aId) === String(bId)) return true;

  if (a?.ticket_id && b?.ticket_id && String(a.ticket_id) === String(b.ticket_id)) return true;

  const aKey = `${a?.client_name || ''}|${a?.address || ''}|${a?.scheduled_start || ''}|${a?.estimated_duration || ''}`;
  const bKey = `${b?.client_name || ''}|${b?.address || ''}|${b?.scheduled_start || ''}|${b?.estimated_duration || ''}`;
  return aKey === bKey;
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
  const [resizingDuration, setResizingDuration] = useState(null); // Para mostrar cambios en tiempo real
  const [dropPreview, setDropPreview] = useState(null); // { teamId, leftPercent, timeStr } para línea de cursor
  const [dragOverTeamId, setDragOverTeamId] = useState(null); // Resaltar equipo durante drag
  const [localWorkOrders, setLocalWorkOrders] = useState(workOrders);
  
  // Refs para detectar resize en tiempo real (sin depender de estado de React)
  const isResizingRef = useRef(false);
  const currentDurationRef = useRef(null); // Para guardar la duración final
  const justFinishedResizingRef = useRef(false); // Para prevenir click después de resize
  const draggedItemRef = useRef(null); // Para identificar la OT durante drag/drop

  const slots = activeTimeBlock === 'morning' ? MORNING_SLOTS : AFTERNOON_SLOTS;
  const startSlot = timeToMinutes(slots[0]);
  const endSlot = timeToMinutes(slots[slots.length - 1]) + 60; // +60 para la última hora completa
  const totalMinutes = endSlot - startSlot;

  useEffect(() => {
    setLocalWorkOrders(workOrders);
  }, [workOrders]);

  // Agrupar OTs por equipo y día
  const allocations = useMemo(() => {
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return localWorkOrders.filter((wo) => {
      if (!wo.scheduled_start) return false;
      const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
      return woDay === dayStr;
    });
  }, [localWorkOrders, currentDate]);

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

  // Calcular duración máxima permitida para una OT (antes de que colisione con la siguiente o fin de turno)
  function getMaxDurationForWorkOrder(wo, teamId) {
    const woStart = new Date(wo.scheduled_start);
    const woStartMinutes = woStart.getHours() * 60 + woStart.getMinutes();
    
    // Límite de fin de turno
    const shiftEndMinutes = activeTimeBlock === 'morning' ? 13 * 60 : 19 * 60; // 13:00 o 19:00
    const maxUntilShiftEnd = shiftEndMinutes - woStartMinutes;
    
    // Obtener todas las OTs del mismo equipo y ordenarlas
    const teamWOs = allocations.filter(w => w.team_id === teamId && w.id !== wo.id);
    
    // Encontrar la próxima OT que empieza después de esta
    const nextWO = teamWOs
      .map(w => {
        const start = new Date(w.scheduled_start);
        const startMin = start.getHours() * 60 + start.getMinutes();
        return { wo: w, startMin };
      })
      .filter(({ startMin }) => startMin > woStartMinutes)
      .sort((a, b) => a.startMin - b.startMin)[0];
    
    let maxDuration = maxUntilShiftEnd;
    
    if (nextWO) {
      // La duración máxima es hasta que empieza la siguiente OT
      maxDuration = Math.min(maxDuration, nextWO.startMin - woStartMinutes);
    }
    
    return Math.max(15, maxDuration); // Garantizar al menos 15 minutos
  }

  // Calcular posición y ancho de una OT
  function getWorkOrderPosition(wo, overrideDuration = null) {
    const woStart = new Date(wo.scheduled_start);
    const woStartMinutes = woStart.getHours() * 60 + woStart.getMinutes();
    const offset = woStartMinutes - startSlot;
    const duration = overrideDuration !== null ? overrideDuration : (wo.estimated_duration || 60);

    const leftPercent = (offset / totalMinutes) * 100;
    const widthPercent = (duration / totalMinutes) * 100;

    return {
      left: Math.max(0, leftPercent),
      width: Math.max(1, widthPercent), // Mínimo 1% para visibilidad (permite 15 min)
      duration,
      offset,
    };
  }

  // Manejar inicio de resize
  function handleResizeStart(e, wo) {
    e.preventDefault();
    e.stopPropagation();
    
    // Marcar como resizing en la ref INMEDIATAMENTE (sin esperar React)
    isResizingRef.current = true;
    
    const originalDuration = wo.estimated_duration || 60;
    const maxDuration = getMaxDurationForWorkOrder(wo, wo.team_id);
    
    // Guardar en ref para uso en handleMouseUp
    currentDurationRef.current = originalDuration;
    
    setIsResizing({
      workOrderId: wo.id,
      startX: e.clientX,
      originalDuration: originalDuration,
      maxDuration: maxDuration,
      startTime: new Date(wo.scheduled_start),
    });

    // Listeners globales para move y end
    function handleMouseMove(moveEvent) {
      const delta = moveEvent.clientX - e.clientX;
      const gridWidth = document.querySelector('.improved-grid-container')?.offsetWidth || window.innerWidth * 0.6;
      const pixelsPerMinute = gridWidth / totalMinutes;
      const deltaMinutes = Math.round(delta / pixelsPerMinute);
      
      // Granularidad de 5 minutos, mínimo 15 min, máximo antes de la siguiente OT o fin de turno
      const roundedDelta = Math.round(deltaMinutes / 5) * 5;
      const newDuration = Math.max(15, Math.min(originalDuration + roundedDelta, maxDuration));

      // Actualizar ref y estado para renderizar suavemente
      currentDurationRef.current = newDuration;
      setResizingDuration(newDuration);
    }

    async function handleMouseUp(upEvent) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Marcar que acaba de terminar un resize (para prevenir click accidental)
      justFinishedResizingRef.current = true;
      setTimeout(() => {
        justFinishedResizingRef.current = false;
      }, 100); // Reset después de 100ms
      
      // Limpiar ref PRIMERO
      isResizingRef.current = false;
      
      // Usar el valor de la ref (que se actualizó en tiempo real)
      const finalDuration = currentDurationRef.current || originalDuration;

      // No guardar si no cambió
      if (finalDuration === originalDuration) {
        setIsResizing(null);
        setResizingDuration(null);
        currentDurationRef.current = null;
        return;
      }

      try {
        setIsAssigning(true);
        // Convertir scheduled_start a ISO string si es necesario
        const scheduledStartISO = wo.scheduled_start instanceof Date 
          ? wo.scheduled_start.toISOString()
          : wo.scheduled_start;
        
        console.log('💾 Guardando resize:', {
          woId: wo.id,
          originalDuration,
          finalDuration,
          scheduledStart: scheduledStartISO,
        });
        
        await api.patch(`/v2/work-orders/${wo.id}/assign`, {
          team_id: wo.team_id,
          scheduled_start: scheduledStartISO,
          estimated_duration: finalDuration,
        });
        
        console.log('✅ Resize guardado exitosamente');
        onWorkOrderUpdated?.();
      } catch (err) {
        console.error('❌ Error resizing:', err);
      } finally {
        setIsAssigning(false);
        setIsResizing(null);
        setResizingDuration(null);
        currentDurationRef.current = null;
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Manejar drag start - Bloquear si se está resizing (usando ref para detección inmediata)
  function handleDragStart(e, wo) {
    // Check la ref, NO el estado (React state es asíncrono)
    if (isResizingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    setDraggedItem(wo);
    draggedItemRef.current = wo;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(wo));
    
    // Ocultar la imagen ghost nativa del navegador (usar solo el preview custom)
    const emptyImage = document.createElement('div');
    emptyImage.style.position = 'absolute';
    emptyImage.style.top = '-9999px';
    document.body.appendChild(emptyImage);
    e.dataTransfer.setDragImage(emptyImage, 0, 0);
    setTimeout(() => document.body.removeChild(emptyImage), 0);
  }
  
  // Limpiar estado al terminar drag (sea drop o cancel)
  function handleDragEnd(e) {
    setDraggedItem(null);
    setDropPreview(null);
    setDragOverTeamId(null);
    draggedItemRef.current = null;
  }

  // Manejar drop en celda - Bloquear si se está resizing
  async function handleDrop(e, teamId) {
    e.preventDefault();
    setDropPreview(null);
    setDragOverTeamId(null);
    
    if (isResizingRef.current) {
      setDraggedItem(null);
      return;
    }

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const wo = JSON.parse(data);
    
    try {
      setIsAssigning(true);
      
      // Encontrar el contenedor del grid
      const gridContainer = document.querySelector('.improved-grid-container');
      if (!gridContainer) {
        console.error('❌ Grid container not found');
        return;
      }
      
      const containerRect = gridContainer.getBoundingClientRect();
      const dropX = e.clientX - containerRect.left;
      const containerWidth = containerRect.width;
      
      // Validar que el drop esté dentro del contenedor
      if (dropX < 0 || dropX > containerWidth) {
        console.warn('⚠️ Drop fuera del contenedor');
        return;
      }
      
      // Calcular minutos desde el inicio del turno basado en pixel position
      const pixelsPerMinute = containerWidth / totalMinutes;
      let minutesFromTurnoStart = (dropX / pixelsPerMinute);
      
      // Snap a 5 minutos
      minutesFromTurnoStart = Math.round(minutesFromTurnoStart / 5) * 5;
      
      // Clamping: no puede ser negativo ni exceder el total de minutos del turno
      minutesFromTurnoStart = Math.max(0, Math.min(minutesFromTurnoStart, totalMinutes - (wo.estimated_duration || 60)));
      
      // Calcular hora y minuto final
      const totalMinutesFromMidnight = startSlot + minutesFromTurnoStart;
      const newHours = Math.floor(totalMinutesFromMidnight / 60);
      const newMinutes = totalMinutesFromMidnight % 60;
      
      // Validación final: verificar que no esté fuera del turno
      const shiftEndMinutes = activeTimeBlock === 'morning' ? 13 * 60 : 19 * 60;
      const woEndMinutes = totalMinutesFromMidnight + (wo.estimated_duration || 60);
      
      if (totalMinutesFromMidnight < startSlot || woEndMinutes > shiftEndMinutes) {
        console.warn('❌ Drop fuera del rango del turno', { 
          totalMinutesFromMidnight, 
          woEndMinutes,
          startSlot, 
          shiftEndMinutes 
        });
        return;
      }
      
      const newScheduledStart = new Date(currentDate);
      newScheduledStart.setHours(newHours, newMinutes, 0, 0);
      
      // Validar colisión con otras tareas (excluyendo la misma tarea que se está moviendo)
      const draggedWo = draggedItemRef.current ?? wo;
      const teamWorkOrders = getTeamWorkOrders(teamId).filter(task => !isSameWorkOrder(task, draggedWo));
      const hasCollision = teamWorkOrders.some(task => {
        const taskStart = new Date(task.scheduled_start);
        const taskStartMinutes = taskStart.getHours() * 60 + taskStart.getMinutes();
        const taskEndMinutes = taskStartMinutes + (task.estimated_duration || 60);
        
        return (
          totalMinutesFromMidnight < taskEndMinutes &&
          woEndMinutes > taskStartMinutes
        );
      });
      
      if (hasCollision) {
        console.warn('❌ Colisión detectada con otra tarea');
        return;
      }
      
      console.log('✅ Dropeo validado (sin colisión):', {
        teamId,
        minutesFromTurnoStart,
        newHours,
        newMinutes,
        duration: wo.estimated_duration,
        newScheduledStart: newScheduledStart.toISOString(),
      });

      const accessToken = localStorage.getItem('emerald_token');
      if (!accessToken) {
        throw new Error('No hay token de sesión disponible');
      }

      const response = await api.patch(
        `/v2/work-orders/${wo.id}/assign`,
        {
          team_id: teamId,
          scheduled_start: newScheduledStart.toISOString(),
          estimated_duration: wo.estimated_duration || 60,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response || response.status < 200 || response.status >= 300) {
        throw new Error(`Error HTTP al asignar OT: ${response?.status}`);
      }

      const updated = response?.data || {};
      setLocalWorkOrders((prev) => prev.map((item) => {
        if (!isSameWorkOrder(item, wo)) return item;
        return {
          ...item,
          team_id: updated.team_id ?? teamId,
          scheduled_start: updated.scheduled_start ?? newScheduledStart.toISOString(),
          scheduled_end: updated.scheduled_end ?? item.scheduled_end,
          estimated_duration: wo.estimated_duration || item.estimated_duration || 60,
        };
      }));

      console.log('💾 OT actualizada en el backend');
      onWorkOrderUpdated?.();
    } catch (err) {
      console.error('❌ Error dropping:', err);
      console.error('Backend error detail:', err.response?.data);
      console.error('Status:', err.response?.status);
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
                <div 
                  className={`flex-1 flex relative improved-grid-container ${
                    dragOverTeamId === team.id ? 'ring-2 ring-emerald-500/50' : ''
                  } transition-all duration-100`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    
                    // Calcular posición exacta con snap a 5 minutos
                    const gridContainer = e.currentTarget;
                    const containerRect = gridContainer.getBoundingClientRect();
                    const dropX = e.clientX - containerRect.left;
                    const containerWidth = containerRect.width;
                    
                    if (dropX >= 0 && dropX <= containerWidth) {
                      const pixelsPerMinute = containerWidth / totalMinutes;
                      let minutesFromTurnoStart = (dropX / pixelsPerMinute);
                      
                      // Snap a 5 minutos
                      minutesFromTurnoStart = Math.round(minutesFromTurnoStart / 5) * 5;
                      minutesFromTurnoStart = Math.max(0, Math.min(minutesFromTurnoStart, totalMinutes));
                      
                      // Calcular posición en porcentaje para la línea
                      const leftPercent = (minutesFromTurnoStart / totalMinutes) * 100;
                      
                      // Calcular hora exacta
                      const totalMinutesFromMidnight = startSlot + minutesFromTurnoStart;
                      const hours = Math.floor(totalMinutesFromMidnight / 60);
                      const minutes = totalMinutesFromMidnight % 60;
                      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                      
                      setDragOverTeamId(team.id);
                      setDropPreview({
                        teamId: team.id,
                        leftPercent,
                        timeStr
                      });
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.target === e.currentTarget) {
                      setDropPreview(null);
                      setDragOverTeamId(null);
                    }
                  }}
                  onDrop={(e) => handleDrop(e, team.id)}
                >
                  {slots.map((slot, slotIdx) => {
                    const isLastSlot = slotIdx === slots.length - 1;
                    
                    return (
                      <div
                        key={`${team.id}-${slot}`}
                        className={`flex-1 border-r border-zinc-700/30 p-2 relative min-h-20 transition-colors ${
                          isLastSlot ? 'border-r-0' : ''
                        } ${
                          dragOverTeamId === team.id ? 'bg-zinc-700/20' : ''
                        }`}
                      >
                        {/* Línea sutil de separación */}
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-700/10" />
                      </div>
                    );
                  })}

                  {/* OTs del equipo renderizadas sobre el grid */}
                  <div className="absolute inset-0 p-2 pointer-events-none">
                    {teamWOs.map((wo) => {
                      // Si se está resizing esta OT, usar la duración del resize
                      const displayDuration = isResizing?.workOrderId === wo.id && resizingDuration !== null 
                        ? resizingDuration 
                        : undefined;
                      const pos = getWorkOrderPosition(wo, displayDuration);
                      
                      const maxDuration = getMaxDurationForWorkOrder(wo, wo.team_id);
                      const isAtMaxDuration = (displayDuration || wo.estimated_duration || 60) >= maxDuration;
                      
                      // Calcular horario de fin
                      const woStart = new Date(wo.scheduled_start);
                      const endTime = new Date(woStart.getTime() + (displayDuration || wo.estimated_duration || 60) * 60000);
                      const timeDisplay = `${String(woStart.getHours()).padStart(2, '0')}:${String(woStart.getMinutes()).padStart(2, '0')} - ${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
                      
                      return (
                        <div
                          key={wo.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, wo)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            // No abrir si acaba de terminar un resize
                            if (!justFinishedResizingRef.current) {
                              onEventClick?.(wo);
                            }
                          }}
                          className={`absolute top-2 h-16 rounded border cursor-move transition-all pointer-events-auto group/task overflow-hidden ${
                            draggedItem?.id === wo.id 
                              ? 'bg-amber-500 border-amber-400 shadow-2xl opacity-80 scale-105' 
                              : isResizing?.workOrderId === wo.id 
                                ? 'bg-amber-500 border-amber-400 shadow-lg' 
                                : 'bg-amber-600/80 border-amber-500/50 hover:bg-amber-700'
                          } ${isAtMaxDuration ? 'border-l-2 border-l-red-500' : ''}`}
                          style={{
                            left: `calc(${pos.left}% + 0.5rem)`,
                            width: `calc(${pos.width}% - 1rem)`,
                            zIndex: draggedItem?.id === wo.id ? 50 : isResizing?.workOrderId === wo.id ? 40 : 10,
                          }}
                        >
                          {/* Contenido */}
                          <div className="p-1.5 h-full flex flex-col text-xs text-white overflow-hidden">
                            <p className="font-bold truncate">{wo.client_name || 'S/N'}</p>
                            {isResizing?.workOrderId === wo.id && (
                              <p className="text-xs font-mono bg-black/20 px-1 rounded mt-0.5">{timeDisplay}</p>
                            )}
                            {!isResizing?.workOrderId === wo.id && (
                              <>
                                <p className="truncate opacity-80 text-xs">{wo.address || '—'}</p>
                                <p className="mt-auto text-xs opacity-75">OT #{wo.id}</p>
                              </>
                            )}
                          </div>

                          {/* Asa de redimensionamiento - DERECHA */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, wo)}
                            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover/task:opacity-100 transition-opacity ${
                              isAtMaxDuration ? 'bg-red-500' : 'bg-emerald-500 hover:bg-emerald-400'
                            }`}
                            title={isAtMaxDuration ? "Limite: próxima tarea" : "Arrastrar para cambiar duración"}
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Línea de cursor para preview del drop */}
                  {dropPreview && dropPreview.teamId === team.id && (
                    <>
                      {/* Línea vertical del cursor */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-lg shadow-emerald-500/50 pointer-events-none z-50 animate-pulse"
                        style={{ left: `${dropPreview.leftPercent}%` }}
                      >
                        {/* Tooltip con la hora */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-2 py-1 rounded text-xs font-mono whitespace-nowrap shadow-lg">
                          {dropPreview.timeStr}
                        </div>
                        {/* Círculo en la parte superior */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-400 rounded-full" />
                        {/* Círculo en la parte inferior */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-400 rounded-full" />
                      </div>
                      
                      {/* Preview de la OT en la posición de drop */}
                      {draggedItem && (
                        <div
                          className="absolute top-2 h-16 rounded border bg-amber-500/60 border-emerald-400 pointer-events-none z-40 shadow-xl"
                          style={{
                            left: `calc(${dropPreview.leftPercent}% + 0.5rem)`,
                            width: `${((draggedItem.estimated_duration || 60) / totalMinutes) * 100}%`,
                            maxWidth: `calc(${((draggedItem.estimated_duration || 60) / totalMinutes) * 100}% - 1rem)`,
                          }}
                        >
                          <div className="p-1.5 h-full flex flex-col text-xs text-white overflow-hidden">
                            <p className="font-bold truncate">{draggedItem.client_name || 'S/N'}</p>
                            <p className="truncate opacity-80 text-xs">{draggedItem.address || '—'}</p>
                            <p className="mt-auto text-xs opacity-75">OT #{draggedItem.id}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
