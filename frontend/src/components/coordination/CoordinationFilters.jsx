/**
 * CoordinationFilters.jsx
 *
 * Panel de filtros multicriterio para reducir ruido visual.
 * Localidades, tipos de trabajo (desde DB), búsqueda universal y prioridad.
 */

import React, { useMemo, useState } from 'react';
import {
  Search,
  Wrench,
  Package,
  ArrowUpFromLine,
  Building2,
  AlertCircle,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

// Map icon names from DB to lucide-react components
const ICON_MAP = {
  Wrench,
  Package,
  ArrowUpFromLine,
  Building2,
};

export default function CoordinationFilters({
  filters,
  availableCities = [],
  onSearchChange,
  onCitiesChange,
  onTypesChange,
  onCriticalChange,
  onClearAll,
  workOrderTypes = [],  // DB-driven work order type configs
}) {
  const [expandCities, setExpandCities] = useState(false);
  const cityList = useMemo(
    () => Array.from(new Set(availableCities)).sort(),
    [availableCities]
  );

  return (
    <div className="space-y-3 p-3 border-b border-zinc-800 bg-zinc-900/50">
      {/* ========== BÚSQUEDA UNIVERSAL ========== */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <Input
          type="text"
          placeholder="ID, cliente, dirección..."
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-8 text-xs bg-zinc-800 border-zinc-700 placeholder:text-zinc-600"
        />
      </div>

      {/* ========== FILTRO DE LOCALIDADES EXPANDIBLE ========== */}
      {cityList.length > 0 && (
        <div className="border border-zinc-700 rounded-lg bg-zinc-800/30 overflow-hidden">
          {/* Header del dropdown */}
          <button
            onClick={() => setExpandCities(!expandCities)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300">📍 Localidades</span>
              {filters.cities.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {filters.cities.length}
                </Badge>
              )}
            </div>
            <ChevronDown
              size={14}
              className={`text-zinc-500 transition-transform ${
                expandCities ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Contenido expandible */}
          {expandCities && (
            <div className="px-2 py-2 border-t border-zinc-700 space-y-1.5 max-h-64 overflow-y-auto bg-zinc-900/50">
              {cityList.map((city) => (
                <label
                  key={city}
                  className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-700/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.cities.includes(city)}
                    onChange={() => onCitiesChange(city)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 cursor-pointer accent-emerald-500"
                  />
                  <span className="text-xs text-zinc-200 flex-1">{city}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== TIPOS DE TRABAJO (desde DB) ========== */}
      {workOrderTypes.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">
            Tipo de Trabajo
          </p>
          <div className="flex gap-1 justify-start flex-wrap">
            {workOrderTypes.map((type) => {
              const Icon = ICON_MAP[type.icon] || Wrench;
              return (
                <Button
                  key={type.code}
                  size="sm"
                  variant={filters.types.includes(type.code) ? 'default' : 'outline'}
                  onClick={() => onTypesChange(type.code)}
                  className={`h-7 px-2 text-xs flex items-center gap-1 ${
                    filters.types.includes(type.code)
                      ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-700'
                      : 'border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  <Icon size={12} />
                  {type.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== PRIORIDAD: SOLO CRÍTICOS ========== */}
      <div className="flex items-center justify-between p-2 rounded bg-zinc-800/30 border border-zinc-700/50">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400" />
          <label className="text-xs text-zinc-300 cursor-pointer">
            Solo críticos/urgentes
          </label>
        </div>
        <Switch
          checked={filters.onlyCritical}
          onCheckedChange={onCriticalChange}
        />
      </div>

      {/* ========== FILTROS ACTIVOS + LIMPIAR ========== */}
      {(filters.search.trim() ||
        filters.cities.length > 0 ||
        filters.types.length > 0 ||
        filters.onlyCritical) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {filters.search.trim() && (
              <Badge
                variant="secondary"
                className="text-[10px] px-2 py-0.5 gap-1 cursor-pointer hover:bg-zinc-700"
                onClick={() => onSearchChange('')}
              >
                🔍 {filters.search}
                <X size={10} />
              </Badge>
            )}
            {filters.cities.map((city) => (
              <Badge
                key={city}
                variant="secondary"
                className="text-[10px] px-2 py-0.5 gap-1 cursor-pointer hover:bg-zinc-700"
                onClick={() => onCitiesChange(city)}
              >
                📍 {city}
                <X size={10} />
              </Badge>
            ))}
            {filters.types.map((typeCode) => {
              const typeConfig = workOrderTypes.find((t) => t.code === typeCode);
              return (
                <Badge
                  key={typeCode}
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 gap-1 cursor-pointer hover:bg-zinc-700"
                  onClick={() => onTypesChange(typeCode)}
                >
                  🔧 {typeConfig?.name || typeCode}
                  <X size={10} />
                </Badge>
              );
            })}
            {filters.onlyCritical && (
              <Badge
                variant="destructive"
                className="text-[10px] px-2 py-0.5 gap-1 cursor-pointer hover:bg-red-700"
                onClick={() => onCriticalChange(false)}
              >
                ⚠️ Críticos
                <X size={10} />
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearAll}
            className="h-6 text-xs text-zinc-400 hover:text-emerald-400"
          >
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}
