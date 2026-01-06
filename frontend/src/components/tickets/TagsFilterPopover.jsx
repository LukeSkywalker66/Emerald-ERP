/**
 * TagsFilterPopover - Componente Reutilizable de Filtro de Etiquetas
 * Usa Command + Popover para coherencia visual con otros filtros
 */

import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

/**
 * TagsFilterPopover
 * @param {Array} selectedTags - IDs de tags seleccionados
 * @param {Function} onTagsChange - Callback cuando cambian los tags
 * @param {Array} availableTags - Catálogo completo de tags
 */
export default function TagsFilterPopover({
  selectedTags = [],
  onTagsChange,
  availableTags = [],
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar tags disponibles según búsqueda
  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleTag = (tagId) => {
    const isSelected = selectedTags.includes(tagId);
    const newSelection = isSelected
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    onTagsChange?.(newSelection);
  };

  const handleClearAll = () => {
    onTagsChange?.([]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-600',
            selectedTags.length > 0 && 'border-emerald-700/50 text-emerald-300 hover:border-emerald-600'
          )}
        >
          <PlusCircle size={14} className="mr-2" />
          Etiquetas
          {selectedTags.length > 0 && (
            <Badge
              variant="outline"
              className="ml-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs"
            >
              {selectedTags.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[240px] p-0 border-zinc-800 bg-zinc-950 shadow-lg"
        align="start"
      >
        <div className="flex flex-col bg-zinc-950 rounded-md">
          {/* Input de búsqueda */}
          <CommandInput
            placeholder="Buscar etiquetas..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="border-0 border-b border-zinc-800 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600 focus:ring-0 focus:border-emerald-600 transition-colors"
          />

          {/* Lista de tags */}
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden bg-zinc-950">
            {filteredTags.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">
                {availableTags.length === 0 ? 'Sin etiquetas disponibles' : 'Sin coincidencias'}
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={cn(
                      'w-full text-left px-2 py-2 rounded-sm mx-1 my-0.5 flex items-center gap-2 transition-all duration-150',
                      isSelected
                        ? 'bg-emerald-950/50 text-emerald-300'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    )}
                  >
                    {/* Checkbox visual */}
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex-shrink-0 transition-colors',
                        isSelected
                          ? 'bg-emerald-600 border-emerald-500 flex items-center justify-center'
                          : 'border-zinc-600 bg-zinc-900'
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Nombre del tag */}
                    <span className="flex-1 text-sm font-medium truncate">
                      {tag.name}
                    </span>

                    {/* Punto de color */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: tag.color?.startsWith('#')
                          ? tag.color
                          : '#10b981', // emerald por defecto
                      }}
                    />
                  </button>
                );
              })
            )}
          </div>

          {/* Separador y botón "Limpiar" */}
          {selectedTags.length > 0 && (
            <>
              <CommandSeparator className="my-1" />
              <div className="px-2 py-1.5">
                <button
                  onClick={handleClearAll}
                  className="w-full text-xs font-medium text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors"
                >
                  Limpiar selección
                </button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
