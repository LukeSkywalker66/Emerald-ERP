import { useState, useCallback, useMemo } from 'react';

export const useTicketFilters = () => {
  const [filters, setFilters] = useState({
    search: '',
    cities: [],
    types: [],
    onlyCritical: false,
  });

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleCity = useCallback((city) => {
    setFilters((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((c) => c !== city)
        : [...prev.cities, city],
    }));
  }, []);

  const toggleType = useCallback((type) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      cities: [],
      types: [],
      onlyCritical: false,
    });
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.search.trim() !== '' ||
      filters.cities.length > 0 ||
      filters.types.length > 0 ||
      filters.onlyCritical,
    [filters]
  );

  return {
    filters,
    updateFilter,
    toggleCity,
    toggleType,
    clearFilters,
    hasActiveFilters,
  };
};
