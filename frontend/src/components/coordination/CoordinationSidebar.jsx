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
      <div className="p-4 border-b border-zinc-800 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            Filtros
          </h2>
        </div>

        {/* Selector de Ciudad */}
        {cities && cities.length > 0 && (
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
              Ciudad
            </label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Todas las ciudades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span>Todas las ciudades</span>
                </SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Switch: Solo Críticas */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" />
            <label className="text-xs font-medium text-zinc-300 cursor-pointer">
              Solo críticas
            </label>
          </div>
          <Switch
            checked={showCriticalOnly}
            onCheckedChange={setShowCriticalOnly}
            className="h-5 w-9"
          />
        </div>

        {/* Búsqueda */}
        <Input
          placeholder="Buscar cliente, dirección..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs bg-zinc-800 border-zinc-700 placeholder:text-zinc-600"
        />
      </div>

      {/* Counter */}
      <div className="px-4 py-2 bg-zinc-900/80 border-b border-zinc-700/50 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          Total: <span className="font-bold text-emerald-400">{totalWOs}</span>
        </span>
        {showCriticalOnly && (
          <Badge variant="destructive" className="text-xs">
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
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={14}
                          className={
                            hasHighPriority
                              ? 'text-red-400'
                              : 'text-zinc-400'
                          }
                        />
                        <span
                          className={`text-sm font-semibold ${
                            hasHighPriority
                              ? 'text-emerald-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {neighborhood}
                        </span>
                      </div>

                      {/* Contadores */}
                      <div className="flex items-center gap-2">
                        {priorityCounts.critical > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {priorityCounts.critical}
                          </Badge>
                        )}
                        {priorityCounts.high > 0 && (
                          <Badge className="bg-orange-600 text-xs">
                            {priorityCounts.high}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {wos.length}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-3 py-2 space-y-2 border-t border-zinc-700/50">
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
