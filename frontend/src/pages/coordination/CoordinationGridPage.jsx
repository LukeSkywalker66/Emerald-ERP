/**
 * CoordinationGridPage.jsx
 * Coordinación de Tareas con Calendario Fluido (15min granularidad)
 * 4 de febrero de 2026
 */

import React, { useState, useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader,
  RotateCcw,
  X,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';
import { useNavigate } from 'react-router-dom';
import CoordinationSidebar from '@/components/coordination/CoordinationSidebar';
import ImprovedCoordinationGrid from '@/components/coordination/ImprovedCoordinationGrid';
import { useCoordinationSync, useOptimisticUpdates } from '@/components/coordination/hooks';


// ========== COMPONENTES ==========

function DetailSheet({ workOrder, isOpen, onClose, onUnassign, onNavigate }) {
  if (!isOpen || !workOrder) return null;

  const typeLabels = {
    repair: 'Reparación',
    install: 'Instalación',
    pickup: 'Retiro',
    infrastructure: 'Infraestructura',
  };

  const typeColors = {
    repair: 'bg-amber-600',
    install: 'bg-emerald-600',
    pickup: 'bg-blue-600',
    infrastructure: 'bg-purple-600',
  };

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
            <Badge className={`${typeColors[workOrder.ot_type] || 'bg-zinc-600'} border-0`}>
              {typeLabels[workOrder.ot_type] || workOrder.ot_type}
            </Badge>
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

          {workOrder.estimated_duration && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Duración Estimada</p>
              <p className="text-sm text-zinc-300">{workOrder.estimated_duration} min</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/80 p-4 space-y-2">
          <Button
            onClick={() => {
              if (onNavigate) {
                onNavigate(`/work-orders/${workOrder.id}`);
              }
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <ExternalLink size={16} className="mr-2" />
            Ejecutar OT
          </Button>
          {workOrder.team_id && (
            <Button
              onClick={() => {
                onUnassign(workOrder.id);
                onClose();
              }}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              Devolver al Backlog
            </Button>
          )}
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
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filtros multicriterio - con sessionStorage para persistencia
  const [filters, setFilters] = useState(() => {
    const stored = sessionStorage.getItem('coordination_filters');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Error restaurando filtros:', e);
      }
    }
    return {
      search: '',
      cities: [],
      types: [],
      onlyCritical: false,
    };
  });

  // activeTimeBlock también en sessionStorage
  const [activeTimeBlockState, setActiveTimeBlockState] = useState(() => {
    const stored = sessionStorage.getItem('coordination_activeTimeBlock');
    return stored || 'morning';
  });

  // Sincronización automática con BD (polling 5s)
  const syncResult = useCoordinationSync(currentDate, true, {
    pollInterval: 5000,
    autoStart: true,
  });

  // Extraer gridData del hook
  const gridData = syncResult.data
    ? {
        teams: syncResult.data.teams,
        allocations: syncResult.data.allocations,
        backlog: syncResult.data.backlog,
        availableCities: syncResult.data.availableCities,
      }
    : null;

  // Optimistic updates para asignaciones
  const optimisticResult = useOptimisticUpdates(
    gridData || { teams: [], allocations: [], backlog: [] }
  );

  // Sincronizar cuando gridData cambia (reset optimistic updates)
  useEffect(() => {
    if (gridData) {
      optimisticResult.syncWithBackend(gridData);
    }
  }, [gridData?.syncedAt]); // Solo sincronizar cuando hay un nuevo sync

  // Persistir filtros en sessionStorage
  useEffect(() => {
    sessionStorage.setItem('coordination_filters', JSON.stringify(filters));
  }, [filters]);

  // Persistir activeTimeBlock en sessionStorage
  useEffect(() => {
    sessionStorage.setItem('coordination_activeTimeBlock', activeTimeBlockState);
  }, [activeTimeBlockState]);

  // Estado derivado
  const isLoading = syncResult.isLoading;
  const error = syncResult.error
    ? typeof syncResult.error === 'string'
      ? syncResult.error
      : syncResult.error.message
    : null;
  const activeTimeBlock = activeTimeBlockState;

  function handleEventClick(event) {
    setSelectedWorkOrder(event);
    setIsDetailOpen(true);
  }

  // Handlers para filtros
  function handleSearchChange(value) {
    setFilters((prev) => ({ ...prev, search: value }));
  }

  function handleCitiesChange(city) {
    setFilters((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((c) => c !== city)
        : [...prev.cities, city],
    }));
  }

  function handleTypesChange(type) {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  }

  function handleCriticalChange(value) {
    setFilters((prev) => ({ ...prev, onlyCritical: value }));
  }

  function handleClearAllFilters() {
    setFilters({
      search: '',
      cities: [],
      types: [],
      onlyCritical: false,
    });
  }

  // Función para recargar manualmente
  const handleManualRefresh = () => {
    syncResult.refetch();
  };

  async function handleUnassignWorkOrder(woId) {
    try {
      // Optimistic update
      const updateId = optimisticResult.applyOptimisticUpdate('unassign', {
        workOrderId: woId,
      });

      // API call
      await api.patch(`/v2/work-orders/${woId}/unassign`);

      // Confirmar optimistic update
      optimisticResult.confirmUpdate(updateId);

      // Trigger refetch para sincronizar con BD
      syncResult.refetch();
    } catch (err) {
      console.error('Error al desasignar OT:', err);
      alert('No se pudo devolver al backlog: ' + (err.response?.data?.detail || err.message));
      // Revertir optimistic update en caso de error
      if (updateId) {
        optimisticResult.revertOptimisticUpdate(updateId);
      }
    }
  }

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* SIDEBAR TÁCTICO */}
      {gridData && (
        <CoordinationSidebar
          workOrders={gridData?.backlog || []}
          onQuickAction={() => {}}
        />
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER CON NAVEGACIÓN DE FECHA */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-emerald-400">
              📱 Coordinación de Tareas
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setCurrentDate(addDays(currentDate, -1))}
              variant="ghost"
              size="sm"
              className="hover:bg-zinc-800"
            >
              <ChevronLeft size={18} />
            </Button>

            <Button
              onClick={() => setCurrentDate(new Date())}
              variant={isToday ? 'default' : 'ghost'}
              size="sm"
              className={isToday ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-zinc-800'}
            >
              {isToday ? 'Hoy' : format(currentDate, 'dd MMM', { locale: es })}
            </Button>

            <Button
              onClick={() => setCurrentDate(addDays(currentDate, 1))}
              variant="ghost"
              size="sm"
              className="hover:bg-zinc-800"
            >
              <ChevronRight size={18} />
            </Button>

            <Button
              onClick={handleManualRefresh}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="hover:bg-zinc-800"
            >
              {isLoading ? <Loader size={18} className="animate-spin" /> : <RotateCcw size={18} />}
            </Button>
          </div>
        </div>

        {/* ÁREA DE CALENDARIO */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs mañana/tarde */}
          <div className="flex gap-2 p-3 border-b border-zinc-800 bg-zinc-900/30 flex-shrink-0">
            <button
              onClick={() => setActiveTimeBlock('morning')}
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                activeTimeBlock === 'morning'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              🌅 Mañana (08:00-12:00)
            </button>
            <button
              onClick={() => setActiveTimeBlock('afternoon')}
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                activeTimeBlock === 'afternoon'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              ☀️ Tarde (13:00-17:00)
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-hidden">
            {isLoading && !gridData ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader className="mx-auto animate-spin text-emerald-400" size={48} />
                  <p className="mt-4 text-zinc-400">Consultando al Orquestador...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md p-6">
                  <AlertCircle className="mx-auto text-red-400" size={48} />
                  <div className="mt-4 text-zinc-300 text-sm">
                    <p className="font-semibold mb-2">Error al cargar coordinación</p>
                    <code className="block bg-red-950/50 p-2 rounded text-xs overflow-auto max-h-24">
                      {String(error).substring(0, 200)}
                    </code>
                  </div>
                  <Button onClick={handleManualRefresh} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : (
              <ImprovedCoordinationGrid
                teams={gridData?.teams || []}
                workOrders={gridData?.allocations || []}
                currentDate={currentDate}
                onWorkOrderUpdated={handleManualRefresh}
                onEventClick={handleEventClick}
                activeTimeBlock={activeTimeBlock}
                filters={filters}
              />
            )}
          </div>
        </div>
      </div>

      {/* DETALLE SHEET */}
      <DetailSheet
        workOrder={selectedWorkOrder}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedWorkOrder(null);
        }}
        onUnassign={handleUnassignWorkOrder}
        onNavigate={(path) => {
          navigate(path);
        }}
      />
    </div>
  );
}
