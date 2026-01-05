import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader } from 'lucide-react';

/**
 * Componente Async Combobox para búsqueda dinámica
 * @param {Function} onSearch - Función que retorna Promise<Array>
 * @param {Function} onSelect - Callback cuando se selecciona un item
 * @param {string} placeholder - Texto del placeholder
 * @param {string} displayField - Campo a mostrar en resultados
 * @param {string} valueField - Campo que se retorna en onSelect
 */
export default function AsyncCombobox({
  onSearch,
  onSelect,
  placeholder = 'Buscar...',
  displayField = 'name',
  valueField = 'id',
  selectedValue = null,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(selectedValue);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Buscar cuando el query cambia (debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 1) {
        setIsLoading(true);
        try {
          const data = await onSearch(query);
          setResults(data || []);
          setOpen(true);
        } catch (err) {
          console.error('Search error:', err);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setOpen(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(item[valueField], item);
  };

  const handleClear = () => {
    setSelectedItem(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(null, null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          placeholder={selectedItem ? `${selectedItem[displayField]}` : placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length > 1 && setOpen(true)}
          disabled={selectedItem !== null}
          className="w-full pl-10 pr-10 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors disabled:opacity-60"
        />
        {selectedItem && (
          <button
            onClick={handleClear}
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        )}
        {isLoading && (
          <Loader size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />
        )}
      </div>

      {/* Dropdown Results */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSelect(item)}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-b-0 focus:outline-none"
            >
              <p className="text-sm font-medium text-white">
                {item[displayField]}
              </p>
              {item.description && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  {item.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {open && query.length > 1 && results.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-400 text-center">
          No se encontraron resultados para "{query}"
        </div>
      )}

      {/* Selected Item Display */}
      {selectedItem && (
        <div className="mt-2 p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30">
          <p className="text-sm text-emerald-300 font-medium">
            {selectedItem[displayField]}
          </p>
          {selectedItem.description && (
            <p className="text-xs text-emerald-200/70 mt-1">
              {selectedItem.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
