/**
 * CoordinationSidebar.jsx
 * 
 * Sidebar táctico con agrupación por barrio y filtros.
 * Diseño compacto para máximo aprovechamiento vertical.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import DraggableWorkOrderCard from './DraggableWorkOrderCard';
import CoordinationFilters from './CoordinationFilters';
import { PendingClosureAlert } from './PendingClosureAlert';
import { useTicketFilters } from '@/hooks/useTicketFilters';
import { applyTicketFilters } from '@/utils/filterWorkOrders';
import {
  groupWorkOrdersByNeighborhood,
  hasHighPriorityTasks,
  countByPriority,
} from '@/utils/groupWorkOrders';
import workOrdersService from '@/services/workOrders.service';

export default function CoordinationSidebar({
  workOrders = [],
  cities = [],
  currentDate = null,
  onQuickAction,
  onSelectWorkOrder,
  defaultCity = null,
  workOrderTypes = [],
  workOrderTypeMap = {},
}) {
  // ========== HOOKS DE FILTROS ==========
  const { filters, updateFilter, toggleCity, toggleType, clearFilters } = useTicketFilters();

  // ========== STATE PARA PENDING CLOSURE ALERT ==========
  const [pendingClosureStats, setPendingClosureStats] = useState(null);
  const [isLoadingPendingStats, setIsLoadingPendingStats] = useState(false);
  const [pendingStatsError, setPendingStatsError] = useState(null);

  // ========== CARGAR STATS AL MONTAR ==========
  useEffect(() => {
    loadPendingClosureStats();
  }, []);

  const loadPendingClosureStats = async () => {
    try {
      setIsLoadingPendingStats(true);
      setPendingStatsError(null);
      const data = await workOrdersService.getPendingClosureStats();
      setPendingClosureStats(data || null);
    } catch (err) {
      console.error('Error loading pending closure stats:', err);
      setPendingStatsError(err?.response?.data?.detail || err.message || 'Error al cargar alertas');
    } finally {
      setIsLoadingPendingStats(false);
    }
  };

  // ========== EXTRAER CIUDADES ÚNICAS ==========
  const availableCities = useMemo(() => {
    const citiesSet = new Set();
    
    // Agregar ciudades del prop `cities` (si vienen desde arriba)
    if (cities && Array.isArray(cities)) {
      cities.forEach(c => {
        if (c && c.trim()) citiesSet.add(c.trim());
      });
    }
    
    // Intentar extraer ciudades de los work orders
    workOrders.forEach(wo => {
      let city = null;

      // Ruta 1: ticket.contact_info.city (enriquecido por backend)
      if (wo.ticket?.contact_info?.city) {
        city = wo.ticket.contact_info.city;
      }
      // Ruta 2: ticket.city (directo)
      else if (wo.ticket?.city) {
        city = wo.ticket.city;
      }
      // Ruta 3: ticket.connection_details.city (JSONB desde backend)
      else if (wo.ticket?.connection_details?.city) {
        city = wo.ticket.connection_details.city;
      }
      // Ruta 4: Extraer del address usando patrones comunes
      else if (wo.ticket?.address) {
        const address = wo.ticket.address;
        
        // Patrón 1: "Localidad: CIUDAD"
        let match = address.match(/Localidad:\s*([A-Za-záéíóúñ\s]+?)(?:$|,|\.|;)/i);
        if (match && match[1]) {
          city = match[1].trim();
        }
        // Patrón 2: "Barrio: CIUDAD" o similar
        else {
          match = address.match(/(?:Zona|Barrio|Ciudad|Localidad):\s*([A-Za-záéíóúñ\s]+?)(?:$|,|\.|;)/i);
          if (match && match[1]) {
            city = match[1].trim().split('/')[0]; // Tomar la primera parte si hay múltiples
          }
        }
        // Patrón 3: Última parte después de la última coma (fallback crude pero útil)
        if (!city) {
          const parts = address.split(',');
          if (parts.length > 1) {
            const lastPart = parts[parts.length - 1].trim();
            // Filtrar partes cortas (típicamente serían provincias o códigos)
            if (lastPart.length > 5 && !lastPart.match(/^\d+$/)) {
              city = lastPart;
            }
          }
        }
      }

      if (city && city.trim() && city.length > 2) {
        citiesSet.add(city.trim());
      }
    });

    const result = Array.from(citiesSet).sort();
    console.log('🏙️ Ciudades/Localidades extraídas:', result, 'de', workOrders.length, 'OTs');
    if (result.length === 0) {
      console.warn('⚠️ Sin ciudades disponibles - verifica que tickets tengan contact_info.city o address con patrón ciudad');
    }
    return result;
  }, [workOrders, cities]);

  // ========== APLICAR FILTROS MULTICRITERIO ==========
  const filteredWorkOrders = useMemo(() => {
    return applyTicketFilters(workOrders, filters);
  }, [workOrders, filters]);

  // ========== AGRUPAR POR BARRIO (DESPUÉS DE FILTRAR) ==========
  const grouped = useMemo(() => {
    return groupWorkOrdersByNeighborhood(filteredWorkOrders, {
      status: ['pending_planning', 'coordinated'],
      criticalOnly: false, // Ya filtrado arriba
      city: null, // Ya filtrado arriba
    });
  }, [filteredWorkOrders]);

  // Contar total
  const totalWOs = useMemo(() => {
    return Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  }, [grouped]);

  // ========== RENDER ==========

  return (
    <div className="h-full min-h-0 flex flex-col bg-zinc-900/50 border-r border-zinc-800">
      {/* ========== PANEL DE FILTROS MULTICRITERIO ========== */}
      <CoordinationFilters
        filters={filters}
        availableCities={availableCities}
        onSearchChange={(val) => updateFilter('search', val)}
        onCitiesChange={toggleCity}
        onTypesChange={toggleType}
        onCriticalChange={(val) => updateFilter('onlyCritical', val)}
        onClearAll={clearFilters}
        workOrderTypes={workOrderTypes}
      />

      <ScrollArea className="flex-1 min-h-0">
        {/* ========== ALERTA GLOBAL: EQUIPOS BLOQUEADOS ========== */}
        <div className="px-3 pt-3">
          <PendingClosureAlert
            stats={pendingClosureStats}
            isLoading={isLoadingPendingStats}
            error={pendingStatsError}
            onRefresh={loadPendingClosureStats}
            onSelectWorkOrder={onSelectWorkOrder}
          />
        </div>

        {/* ========== CONTADOR ========== */}
        <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-700/50 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            Mostrando: <span className="font-bold text-emerald-400">{totalWOs}</span>
            <span className="text-zinc-600">
              / {workOrders.length}
            </span>
          </span>
        </div>

        {/* ========== LISTA AGRUPADA POR BARRIO ========== */}
        {Object.keys(grouped).length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-zinc-500">
              {workOrders.length === 0
                ? 'Sin órdenes de trabajo'
                : 'Sin coincidencias en los filtros'}
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={Object.keys(grouped).slice(0, 3)}
            className="w-full px-3 py-2 space-y-2"
          >
            {Object.entries(grouped).map(([neighborhood, wos]) => {
              const hasHighPriority = hasHighPriorityTasks(wos);
              const priorityCounts = countByPriority(wos);

              return (
                <AccordionItem
                  key={neighborhood}
                  value={neighborhood}
                  className="border border-zinc-700/50 rounded-lg bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors"
                >
                  <AccordionTrigger className="px-3 py-1.5 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-1.5">
                        <MapPin
                          size={12}
                          className={
                            hasHighPriority
                              ? 'text-red-400'
                              : 'text-zinc-400'
                          }
                        />
                        <span
                          className={`text-xs font-semibold ${
                            hasHighPriority
                              ? 'text-emerald-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {neighborhood}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {priorityCounts.critical > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {priorityCounts.critical}
                          </Badge>
                        )}
                        {priorityCounts.high > 0 && (
                          <Badge className="bg-orange-600 text-[10px] px-1.5 py-0">
                            {priorityCounts.high}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {wos.length}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-2 py-1.5 space-y-1.5 border-t border-zinc-700/50">
                    {wos.map((wo) => (
                      <DraggableWorkOrderCard
                        key={wo.id}
                        workOrder={wo}
                        currentDate={currentDate}
                        onQuickAction={onQuickAction}
                        workOrderTypeMap={workOrderTypeMap}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
}
