/**
 * FluidCoordinationCalendar.jsx
 * 
 * Calendario de coordinación con drag & drop fluido.
 * Granularidad: 15 minutos.
 * Permite mover entre teams y redimensionar duración.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addMinutes, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './FluidCoordinationCalendar.css';
import api from '@/api/client';

// ========== CONFIG ==========

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

// ========== COMPONENTE ==========

export default function FluidCoordinationCalendar({
  teams = [],
  workOrders = [],
  currentDate = new Date(),
  onWorkOrderUpdated,
  onEventClick,
}) {
  const [isDragging, setIsDragging] = useState(false);

  // ========== TRANSFORMAR DATOS ==========

  /**
   * Convertir teams a resources para react-big-calendar
   */
  const resources = useMemo(() => {
    return teams.map((team) => ({
      resourceId: team.id,
      resourceTitle: team.name,
    }));
  }, [teams]);

  /**
   * Convertir work orders a events
   */
  const events = useMemo(() => {
    return workOrders
      .filter((wo) => wo.scheduled_start && wo.team_id)
      .map((wo) => {
        const start = new Date(wo.scheduled_start);
        const end = wo.scheduled_end 
          ? new Date(wo.scheduled_end)
          : addMinutes(start, wo.estimated_duration || 60);

        return {
          id: wo.id,
          title: wo.client_name || `OT #${wo.id}`,
          start,
          end,
          resourceId: wo.team_id,
          workOrder: wo,
        };
      });
  }, [workOrders]);

  // ========== HANDLERS ==========

  /**
   * Mover evento (cambiar horario o team)
   */
  const handleEventDrop = useCallback(
    async ({ event, start, end, resourceId }) => {
      try {
        setIsDragging(true);

        const newTeamId = resourceId || event.resourceId;
        const newDuration = differenceInMinutes(end, start);

        console.log('📦 Moviendo OT:', {
          id: event.id,
          oldTeam: event.resourceId,
          newTeam: newTeamId,
          oldStart: event.start,
          newStart: start,
          duration: newDuration,
        });

        // Llamar API
        await api.patch(`/v2/work-orders/${event.id}/assign`, {
          team_id: newTeamId,
          scheduled_start: start.toISOString(),
          estimated_duration: newDuration,
        });

        console.log('✅ OT movida exitosamente');

        // Notificar al parent para refrescar
        if (onWorkOrderUpdated) {
          onWorkOrderUpdated();
        }
      } catch (err) {
        console.error('❌ Error moviendo OT:', err);
        alert(`Error: ${err.response?.data?.detail || err.message}`);
        
        // Rollback en caso de error (recargar)
        if (onWorkOrderUpdated) {
          onWorkOrderUpdated();
        }
      } finally {
        setIsDragging(false);
      }
    },
    [onWorkOrderUpdated]
  );

  /**
   * Redimensionar evento (cambiar duración)
   */
  const handleEventResize = useCallback(
    async ({ event, start, end }) => {
      try {
        setIsDragging(true);

        const newDuration = differenceInMinutes(end, start);

        console.log('🔧 Redimensionando OT:', {
          id: event.id,
          oldDuration: differenceInMinutes(event.end, event.start),
          newDuration,
        });

        // Llamar API
        await api.patch(`/v2/work-orders/${event.id}/assign`, {
          team_id: event.resourceId,
          scheduled_start: start.toISOString(),
          estimated_duration: newDuration,
        });

        console.log('✅ Duración actualizada');

        if (onWorkOrderUpdated) {
          onWorkOrderUpdated();
        }
      } catch (err) {
        console.error('❌ Error redimensionando OT:', err);
        alert(`Error: ${err.response?.data?.detail || err.message}`);
        
        if (onWorkOrderUpdated) {
          onWorkOrderUpdated();
        }
      } finally {
        setIsDragging(false);
      }
    },
    [onWorkOrderUpdated]
  );

  /**
   * Click en evento
   */
  const handleSelectEvent = useCallback(
    (event) => {
      if (onEventClick) {
        onEventClick(event.workOrder);
      }
    },
    [onEventClick]
  );

  // ========== CUSTOM COMPONENTS ==========

  /**
   * Custom Event Component (tarjeta de OT)
   */
  const EventComponent = ({ event }) => {
    const typeConfig = {
      repair: 'bg-amber-600/90',
      install: 'bg-emerald-600/90',
      pickup: 'bg-blue-600/90',
      infrastructure: 'bg-purple-600/90',
    };

    const bgColor = typeConfig[event.workOrder?.ot_type] || 'bg-zinc-600/90';

    return (
      <div
        className={`
          ${bgColor} text-white p-1 rounded border-l-4 border-white/50
          text-xs leading-tight cursor-move hover:shadow-lg transition-shadow
          ${isDragging ? 'opacity-60 shadow-2xl' : 'opacity-100'}
        `}
      >
        <div className="font-bold truncate">{event.title}</div>
        <div className="text-white/80 truncate text-[10px]">
          OT #{event.id}
        </div>
      </div>
    );
  };

  /**
   * Custom Resource Header (nombre del team)
   */
  const ResourceHeader = ({ label }) => (
    <div className="p-2 bg-zinc-900 border-b border-zinc-700 text-center">
      <p className="text-sm font-bold text-emerald-400">{label}</p>
    </div>
  );

  // ========== RENDER ==========

  return (
    <div className="h-full bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
      <DnDCalendar
        localizer={localizer}
        events={events}
        resources={resources}
        resourceIdAccessor="resourceId"
        resourceTitleAccessor="resourceTitle"
        startAccessor="start"
        endAccessor="end"
        defaultView="day"
        views={['day']}
        date={currentDate}
        onNavigate={() => {}}
        step={15}
        timeslots={4}
        min={new Date(0, 0, 0, 8, 0, 0)}
        max={new Date(0, 0, 0, 19, 0, 0)}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        onSelectEvent={handleSelectEvent}
        resizable
        selectable={false}
        components={{
          event: EventComponent,
          resourceHeader: ResourceHeader,
        }}
        eventPropGetter={(event) => ({
          style: {
            border: 'none',
            borderRadius: '6px',
          },
        })}
        slotPropGetter={(date) => ({
          style: {
            borderColor: 'rgba(113, 113, 122, 0.1)',
            borderStyle: 'dashed',
          },
        })}
        dayPropGetter={() => ({
          style: {
            backgroundColor: '#18181b',
          },
        })}
      />
    </div>
  );
}
