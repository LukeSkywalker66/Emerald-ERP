/**
 * CoordinationSidebar.jsx
 * 
 * Sidebar táctico con agrupación por barrio y filtros.
 * Diseño compacto para máximo aprovechamiento vertical.
 */

import React, { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { AlertCircle, MapPin, Filter } from 'lucide-react';
import DraggableWorkOrderCard from './DraggableWorkOrderCard';
import {
  groupWorkOrdersByNeighborhood,
  hasHighPriorityTasks,
  countByPriority,
} from '@/utils/groupWorkOrders';

export default function CoordinationSidebar({
  workOrders = [],
  cities = [],
  onQuickAction,
  defaultCity = null,
}) {
  // ========== STATE ==========
  const [selectedCity, setSelectedCity] = useState(defaultCity || '');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ========== EXTRAER CIUDADES ÚNICAS ==========
  const availableCities = useMemo(() => {
    const citiesSet = new Set();
    workOrders.forEach(wo => {
      const city = wo.ticket?.city || wo.ticket?.connection_details?.city;
      if (city && city.trim()) {
        citiesSet.add(city.trim());
      }
    });
    return Array.from(citiesSet).sort();
  }, [workOrders]);

  // ========== COMPUTADOS ==========
  const grouped = useMemo(() => {
    return groupWorkOrdersByNeighborhood(workOrders, {
      status: ['pending_planning', 'coordinated'],
      criticalOnly: showCriticalOnly,
      city: selectedCity || null,
    });
  }, [workOrders, showCriticalOnly, selectedCity]);

  // Contar total
  const totalWOs = useMemo(() => {
    return Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  }, [grouped]);

  // Filtrar por búsqueda (cliente o dirección)
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;

    const filtered = {};
    Object.entries(grouped).forEach(([neighborhood, wos]) => {
      const matches = wos.filter(wo => {
        const clientMatch = wo.ticket?.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const addressMatch = wo.ticket?.address?.toLowerCase().includes(searchQuery.toLowerCase());
        const idMatch = wo.id.toString().includes(searchQuery);
        return clientMatch || addressMatch || idMatch;
      });

      if (matches.length > 0) {
        filtered[neighborhood] = matches;
      }
    });
    return filtered;
  }, [grouped, searchQuery]);

  // ========== RENDER ==========

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 border-r border-zinc-800">
      {/* Header: Filtros */}
      <div className="p-3 border-b border-zinc-800 space-y-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wide">
              Filtros
            </h2>
          </div>
        </div>

        {/* ========== FILTRO DE CIUDAD ========== */}
        {availableCities.length > 0 && (
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">
              📍 Ciudad/Localidad
            </label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Todas las localidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-xs">Todas las localidades</span>
                </SelectItem>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    <span className="text-xs">{city}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Switch: Solo Críticas */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-400" />
            <label className="text-[10px] font-medium text-zinc-300 cursor-pointer">
              Solo críticas/urgentes
            </label>
          </div>
          <Switch
            checked={showCriticalOnly}
            onCheckedChange={setShowCriticalOnly}
            className="h-4 w-8"
          />
        </div>

        {/* Búsqueda */}
        <Input
          placeholder="Buscar cliente, dirección, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 text-xs bg-zinc-800 border-zinc-700 placeholder:text-zinc-600"
        />
      </div>

      {/* Counter */}
      <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-700/50 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">
          Total: <span className="font-bold text-emerald-400">{totalWOs}</span>
          {selectedCity && (
            <span className="ml-2 text-zinc-500">en {selectedCity}</span>
          )}
        </span>
        {showCriticalOnly && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            ⚠️ Críticas
          </Badge>
        )}
      </div>

      {/* Contenido: Acordeones por Barrio */}
      <ScrollArea className="flex-1">
        {Object.keys(filteredGrouped).length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-zinc-500">
              {totalWOs === 0
                ? 'Sin órdenes de trabajo pendientes'
                : 'Sin coincidencias en la búsqueda'}
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            className="w-full px-3 py-2 space-y-2"
          >
            {Object.entries(filteredGrouped).map(([neighborhood, wos]) => {
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

                      {/* Contadores */}
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
                        onQuickAction={onQuickAction}
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
