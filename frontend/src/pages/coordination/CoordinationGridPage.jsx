/**
 * CoordinationGridPage.jsx
 * Coordinación de Tareas con Calendario Fluido (15min granularidad)
 * 4 de febrero de 2026
 */

import React, { useState, useEffect, useCallback } from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import CoordinationSidebar from '@/components/coordination/CoordinationSidebar';
import CoordinationSheet from '@/components/coordination/CoordinationSheet';
import ImprovedCoordinationGrid from '@/components/coordination/ImprovedCoordinationGrid';
import { useCoordinationSync } from '@/components/coordination/hooks';


// ========== PÁGINA PRINCIPAL ==========

export default function CoordinationGridPage() {
  const location = useLocation();

  const [currentDate, setCurrentDate] = useState(() => {
    const stateDate = location.state?.date;
    if (!stateDate) return new Date();

    const parsedDate = new Date(stateDate);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  });
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

  // ========== ESTADO PARA OPTIMISTIC UPDATES ==========
  // Mantenermos una copia del estado de workOrders para aplicar cambios optimistas
  const [optimisticAllocations, setOptimisticAllocations] = useState([]);
  
  // Sincronizar con BD cuando gridData cambia
  useEffect(() => {
    if (gridData?.allocations) {
      setOptimisticAllocations(gridData.allocations);
    }
  }, [gridData?.allocations]);

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

  // ========== CALLBACKS: Optimistic Updates ==========
  const handleOptimisticAssign = useCallback((wo, newTeamId, scheduledStartISO) => {
    console.log('💡 Optimistic assign:', wo.id, 'to team', newTeamId);
    
    setOptimisticAllocations((prev) => {
      // Buscar si ya existe (cambio de team)
      const existing = prev.findIndex(
        (item) => (item?.id ?? item?.work_order_id) === (wo?.id ?? wo?.work_order_id)
      );

      const optimisticWO = {
        ...wo,
        team_id: newTeamId,
        scheduled_start: scheduledStartISO,
        _isOptimistic: true, // Flag para UI feedback
      };

      if (existing >= 0) {
        // Actualizar existente
        const updated = [...prev];
        updated[existing] = optimisticWO;
        return updated;
      } else {
        // Agregar nuevo (desde backlog)
        return [...prev, optimisticWO];
      }
    });
  }, []);

  const handleRollbackAssign = useCallback((woId) => {
    console.log('🔄 Rollback assign:', woId);
    
    setOptimisticAllocations((prev) => {
      // Si la OT vino del backlog (no estaba en allocations antes), removerla
      // Si estaba en otra posición, no hacemos nada aquí (siguiente polling limpia)
      return prev.filter((wo) => (wo?.id ?? wo?.work_order_id) !== woId);
    });
  }, []);

  const handleOptimisticResize = useCallback((woId, newDuration) => {
    console.log('💡 Optimistic resize:', woId, 'duration:', newDuration);
    
    setOptimisticAllocations((prev) =>
      prev.map((wo) =>
        (wo?.id ?? wo?.work_order_id) === woId
          ? { ...wo, estimated_duration: newDuration, _isOptimistic: true }
          : wo
      )
    );
  }, []);

  const handleRollbackResize = useCallback((woId) => {
    console.log('🔄 Rollback resize:', woId);
    
    // Simplemente dejar que el próximo polling traiga el valor correcto
    // No hacemos nada aquí porque la BD es la fuente de verdad
  }, []);

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isDateSwitchLoading = isLoading && Boolean(gridData);

  return (
    <div className="flex h-screen min-h-0 bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* SIDEBAR TÁCTICO */}
      {gridData && (
        <CoordinationSidebar
          workOrders={gridData?.backlog || []}
          currentDate={currentDate}
          onQuickAction={() => handleManualRefresh()}
          onSelectWorkOrder={handleEventClick}
        />
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isDateSwitchLoading && (
            <div className="px-4 py-2 border-b border-emerald-800/40 bg-emerald-950/30 text-xs text-emerald-300 flex items-center gap-2">
              <Loader size={14} className="animate-spin" />
              Cargando agenda de {format(currentDate, 'dd MMM yyyy', { locale: es })}...
            </div>
          )}

          {/* Tabs mañana/tarde */}
          <div className="flex gap-2 p-3 border-b border-zinc-800 bg-zinc-900/30 flex-shrink-0 select-none">
            <button
              onClick={() => setActiveTimeBlockState('morning')}
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium cursor-pointer ${
                activeTimeBlock === 'morning'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              🌅 Mañana (08:00-12:00)
            </button>
            <button
              onClick={() => setActiveTimeBlockState('afternoon')}
              className={`px-4 py-2 rounded-lg transition-all text-sm font-medium cursor-pointer ${
                activeTimeBlock === 'afternoon'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              ☀️ Tarde (13:00-17:00)
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 min-h-0 overflow-hidden">
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
                workOrders={optimisticAllocations}
                currentDate={currentDate}
                onWorkOrderUpdated={handleManualRefresh}
                onEventClick={handleEventClick}
                activeTimeBlock={activeTimeBlock}
                filters={filters}
                // ========== NUEVOS CALLBACKS ==========
                onOptimisticAssign={handleOptimisticAssign}
                onRollbackAssign={handleRollbackAssign}
                onOptimisticResize={handleOptimisticResize}
                onRollbackResize={handleRollbackResize}
              />
            )}
          </div>
        </div>
      </div>

      {/* DETALLE SHEET (con edición de duración) */}
      <CoordinationSheet
        workOrder={selectedWorkOrder}
        currentDate={currentDate}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedWorkOrder(null);
        }}
        onDurationChange={(newDuration) => {
          console.log(`✅ Duración actualizada a ${newDuration} min`);
          // Refrescar datos después de cambiar duración
          handleManualRefresh();
        }}
        onWorkOrderUpdated={() => handleManualRefresh()}
      />
    </div>
  );
}
