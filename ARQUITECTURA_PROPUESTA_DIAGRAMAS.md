# ARQUITECTURA NASA-GRADE: Diagramas y Pseudocódigo
**Coordinación Module - Clean Architecture**

---

## 1. FLUJO DE DATOS: ACTUAL vs PROPUESTO

### 1.1 ACTUAL (PROBLEMÁTICO)

```
USER WINDOW                    FRONTEND MEMORY              BACKEND
┌─────────────────┐           ┌─────────────────────┐      ┌──────────────────┐
│                 │           │                     │      │ PostgreSQL 15    │
│  ImprovedGrid   │◄──────────│ gridData (state)    │◄─────│ work_orders      │
│                 │           │                     │      │ work_order_events│
│  -Drag & drop   │           │ localWorkOrders     │      │                  │
│  -Resize        │           │ (state)             │      │ CANONICAL DATA   │
│  -Render cards  │           │                     │      │                  │
│                 │           │ lastAssignedRef     │      └──────────────────┘
│ [User drags     │           │ (memory)            │              ▲
│  OT from A→B]   │           │                     │              │
│                 │           │ pendingAssignments  │       Polling (3s)
│                 │           │ (state)             │              │
└────────┬────────┘           │                     │              │
         │                    │ localStorage: {     │              │
         │                    │   'grid_2026-02-24' │              │
         │                    │ }                   │              │
         ▼                    │                     │              │
  PATCH /assign  ─────────────┼──────────────────────────────────▶
  {team_id, time}             │                     │              │
                              │◄────────────────────┼──────────────┤
                              │                     │     Response │
                              └─────────────────────┘      {...}  │
                              
PROBLEMAS VISIBLES:
1. localStorage SNAPSHOT (T=1) vs BD ACTUAL (continuo)
2. 5 estados concurrentes que pueden divergir
3. Polling retorna data FRESCA pero localStorage sobrescribe
4. Sin transacciones ACID en frontend
5. Race conditions entre merge logic
```

### 1.2 PROPUESTO (LIMPIO)

```
USER WINDOW                   FRONTEND LAYERS                BACKEND
┌─────────────────┐          ┌─────────────────────────────┐ ┌──────────────┐
│                 │          │ REACT STATE (Cache)         │ │ PostgreSQL15 │
│  ImprovedGrid   │          │ ┌─────────────────────────┐ │ │ work_orders  │
│                 │◄─────────│ │ cdnData = {              │ │ │ events       │
│  -Render from:  │          │ │   teams: [],            │ │ │              │
│    coordinState │          │ │   allocations: [],      │ │ │ SINGLE       │
│    + optimistic │          │ │   backlog: [],          │ │ │ SOURCE OF    │
│                 │          │ │   syncedAt: TS          │ │ │ TRUTH        │
│ [User drags A→B]│          │ │ }                       │ │ │              │
│                 │          │ │                         │ │ │              │
└────────┬────────┘          │ │ UI STATE                │ │ └──────────────┘
         │                   │ │ (NEVER persisted)       │ │        ▲
         │                   │ │ ┌──────────────────────┐│ │        │
         │                   │ │ │ filters {search,     ││ │   Polling 5s
         │                   │ │ │   cities, types,...} ││ │   + Visibility
         │                   │ │ │ activeTimeBlock      ││ │        │
         │                   │ │ │ selectedWorkOrderId  ││ │        │
         │                   │ │ └──────────────────────┘│ │        │
         │                   │ │                         │ │   ┌─────────────┐
         │                   │ │ OPTIMISTIC (Temporary) │ │   │ GET /coord/ │
         │                   │ │ ┌──────────────────────┐│ │   │   grid      │
         │                   │ │ │ Map<woId> {          ││ │   └─────────────┘
         │                   │ │ │   team_id,           ││ │        │
         │                   │ │ │   scheduled_start    ││ │        │
         │                   │ │ │   isOptimistic:true  ││ │        │
         │                   │ │ │ }                    ││ │        │
         │                   │ │ └──────────────────────┘│ │        │
         │                   │ │                         │ │        │
         │                   │ │ sessionStorage: {       │ │        │
         │                   │ │   filters (UI prefs)    │ │        │
         │                   │ │ }                       │ │        │
         │                   │ └─────────────────────────┘ │        │
         │                   └─────────────────────────────┘        │
         │                                                          │
         ├─ PATCH /assign ──────────────────────────────────────────▶
         │  (optimistic update SHOWN immediately)                   │
         │                                                          │
         └◄─────────────────────────────────────────────────────────┘
            Respuesta 200 OK (confirma) o 4xx (revierte)

VENTAJAS:
✅ BD es SINGLE SOURCE OF TRUTH
✅ Frontend es CACHE + UI STATE (ambos NO persistentes)
✅ sessionStorage solo para PREFERENCIAS (filtros, turno)
✅ Optimistic updates → UI respuesta INMEDIATA
✅ Si falla: revert automático
✅ Polling es "pull" limpio del BD
✅ Sin localStorage de datos críticos
✅ Recuperable: reload = GET fresco de BD
✅ Transacciones ACID garantizadas en backend
```

---

## 2. ARQUITECTURA DE COMPONENTES

### 2.1 Dependency Graph (ACTUAL)

```
CoordinationFilters ──┐  ← EXISTE pero AISLADO
                      │
                      (NO INTEGRADO)
                      │
                      ▼
CoordinationGridPage  ← Importa ImprovedCoordinationGrid
      ├─ DetailSheet  ← Inline (estático)
      └─ ImprovedCoordinationGrid
          ├─ DraggableWorkOrderCard (recursivo)
          ├─ localStorage logic (PROBLEMA)
          ├─ API calls
          └─ Merge inteligente (PROBLEMA)
          
CoordinationSidebar ──┐  ← Referenciado por Page
                      │
                      (Possible users de CoordinationSheet?)
                      │
CoordinationSheet ────┘  ← EXISTE pero AISLADO
                      (Duplicate de DetailSheet?)
                      
PROBLEMAS:
❌ CoordinationFilters no puede filtrar
❌ CoordinationSheet integridad desconocida
❌ Dependencias implícitas (data flow poco claro)
```

### 2.2 Dependency Graph (PROPUESTO)

```
┌─────────────────────────────────────────────────────┐
│ CoordinationGridPage (orchestrator)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  useCoordinationSync(currentDate)  ◄─┐              │
│   → coordinationState                │              │
│   → Loading, error handling          │ (NEW HOOK)   │
│   → Auto-polling (5s + visibility)   │              │
│                                      │              │
│  useOptimisticUpdates()  ◄──────────┘ (NEW HOOK)   │
│   → optimisticUpdatesRef                           │
│   → handleOptimisticUpdate()                        │
│   → handleRevert()                                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Props passed down:                                  │
│  - coordinationState                                │
│  - optimisticUpdatesRef                             │
│  - filters (state)                                  │
│  - onFilterChange (handlers)                        │
└─────────────────────────────────────────────────────┘
         ▼  ▼  ▼                                       
      ┌──────────────┐                               
      │  **Navigation / Header**                      
      │  - Date picker                               
      │  - Turno (morning/afternoon)                 
      │  - Refresh button                            
      └──────────────┘                               
         ▼ ▼ ▼                                        
┌─────────────────────────────────────────────────────┐
│ CoordinationFilters (INTEGRADO)                     │
│  ← filters state                                    │
│  → onFilterChange()                                 │
├─────────────────────────────────────────────────────┤
│ Features:                                           │
│  - Search universal                                │
│  - Cities multi-select                              │
│  - Types toggle                                     │
│  - Critical filter                                  │
│  - sessionStorage persist                           │
└─────────────────────────────────────────────────────┘
         ▼ ▼ ▼                                        
┌─────────────────────────────────────────────────────┐
│ ImprovedCoordinationGrid (main render)              │
│  ← coordinationState                                │
│  ← filters                                          │
│  ← optimisticUpdatesRef                             │
│  → onDrop, onResize (call optimistic)               │
├─────────────────────────────────────────────────────┤
│ Responsibilities:                                   │
│  1. Filter workOrders by (search, cities, types)   │
│  2. Overlay optimistic on display data              │
│  3. Render grid with teams                          │
│  4. Show drop previews & tooltips                   │
│  5. Call handlers (optimistic updates)              │
└─────────────────────────────────────────────────────┘
     ▼ ▼ ▼                                            
┌─────────────────────────────────────────────────────┐
│ DraggableWorkOrderCard x N                          │
│  ← workOrder data                                   │
│  ← isOptimistic boolean                             │
│  ← teamAssignments                                  │
│  → onDrag, onResize                                 │
├─────────────────────────────────────────────────────┤
│  Visual:                                            │
│  - Tactical HUD (48-54px)                           │
│  - Rich tooltip                                     │
│  - Drag glow (amber-500)                            │
│  - Optimistic fade (opacity-75 pulse)               │
│  - Resize preview                                   │
└─────────────────────────────────────────────────────┘
     ▼ ▼ ▼                                            
┌─────────────────────────────────────────────────────┐
│ CoordinationSidebar + DetailSheet                   │
│  ← backlog workOrders                               │
│  ← selectedWorkOrderId                              │
│  → onSelect, onQuickAction                          │
└─────────────────────────────────────────────────────┘

MEJORAS vs ACTUAL:
✅ Flujo de datos UNIDIRECCIONAL (React best practice)
✅ Props explícitas (no globals)
✅ Hooks centralizados en Page
✅ Componentes UI PUROS (sin state side-effects)
✅ Fácil de testear (test hooks independientemente)
```

---

## 3. HOOKS CUSTOM (A CREAR)

### 3.1 useCoordinationSync

```typescript
// coordination/hooks/useCoordinationSync.ts

interface CoordinationData {
  teams: Team[];
  allocations: WorkOrder[];
  backlog: WorkOrder[];
  availableCities: string[];
  syncedAt: number;
}

interface ConfigObject {
  pollInterval?: number; // default 5000ms
  autoStart?: boolean;   // default true
  onError?: (error: Error) => void;
  onSync?: (data: CoordinationData) => void;
}

/**
 * Manages polling for coordination grid data.
 * Automatically handles:
 * - Polling every 5 seconds
 * - Pause when page is hidden (Visibility API)
 * - Exponential backoff on errors
 * - Deduplication of requests
 * 
 * @param currentDate Date to fetch for
 * @param enabled Whether polling is active
 * @param config { pollInterval, autoStart, onError, onSync }
 * @returns { data, isLoading, error, refetch, start, stop }
 */
export function useCoordinationSync(
  currentDate: Date,
  enabled: boolean = true,
  config: ConfigObject = {}
) {
  const [data, setData] = useState<CoordinationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const {
    pollInterval = 5000,
    autoStart = true,
    onError,
    onSync,
  } = config;
  
  // 1. Handle document visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden → stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else {
        // Page is visible → resume polling
        if (autoStart && enabled && !pollingIntervalRef.current) {
          startPolling();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoStart, enabled]);
  
  // 2. Fetch function
  const fetchData = async () => {
    const now = Date.now();
    const minInterval = 1000; // Min 1s between requests
    
    if (now - lastFetchRef.current < minInterval) {
      return; // Too soon, skip
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const dateParam = format(currentDate, 'yyyy-MM-dd');
      const response = await api.get('/v2/work-orders/coordination/grid', {
        params: {
          start_date: dateParam,
          end_date: dateParam,
        },
        signal: abortControllerRef.current.signal,
      });
      
      lastFetchRef.current = now;
      setData(response.data);
      onSync?.(response.data);
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        const error = new Error(err.message);
        setError(error);
        onError?.(error);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 3. Start/stop polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling
    
    fetchData(); // Fetch immediately
    
    pollingIntervalRef.current = setInterval(() => {
      fetchData();
    }, pollInterval);
  }, [pollInterval]);
  
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);
  
  // 4. Setup polling on mount/enabled change
  useEffect(() => {
    if (enabled && autoStart && !document.hidden) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [enabled, autoStart, currentDate]);
  
  // 5. Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    start: startPolling,
    stop: stopPolling,
  };
}
```

### 3.2 useOptimisticUpdates

```typescript
// coordination/hooks/useOptimisticUpdates.ts

interface OptimisticEntry {
  workOrder: WorkOrder;
  savedAt: number;
  isPending: boolean;
}

/**
 * Manages optimistic updates for work order assignments.
 * 
 * Flow:
 * 1. setOptimistic() → Map entry + UI update
 * 2. Backend responds
 * 3. confirmOptimistic() → remove from map
 *    OR revertOptimistic() → remove and show error
 * 
 * @returns {
 *   optimisticMap: Map<id, entry>,
 *   setOptimistic: (wo, metadata) => void,
 *   confirmOptimistic: (woId) => void,
 *   revertOptimistic: (woId, error) => void
 * }
 */
export function useOptimisticUpdates() {
  const [optimisticMap, setOptimisticMap] = useState<
    Map<string | number, OptimisticEntry>
  >(new Map());
  
  const setOptimistic = useCallback((
    workOrder: WorkOrder,
    metadata?: Partial<WorkOrder>
  ) => {
    const woId = workOrder.id ?? workOrder.work_order_id;
    
    const updated = {
      ...workOrder,
      ...metadata,
    };
    
    setOptimisticMap(prev => {
      const next = new Map(prev);
      next.set(woId, {
        workOrder: updated,
        savedAt: Date.now(),
        isPending: true,
      });
      return next;
    });
  }, []);
  
  const confirmOptimistic = useCallback((woId: string | number) => {
    setOptimisticMap(prev => {
      const next = new Map(prev);
      next.delete(woId);
      return next;
    });
  }, []);
  
  const revertOptimistic = useCallback((
    woId: string | number,
    error?: Error | string
  ) => {
    // Remove from optimistic map
    setOptimisticMap(prev => {
      const next = new Map(prev);
      next.delete(woId);
      return next;
    });
    
    // Optionally log error
    if (error) {
      console.error('Optimistic update reverted:', error);
    }
  }, []);
  
  // Auto-revert if pending for too long (30 seconds)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOptimisticMap(prev => {
        const now = Date.now();
        const next = new Map(prev);
        
        for (const [woId, entry] of next.entries()) {
          if (entry.isPending && now - entry.savedAt > 30000) {
            next.delete(woId);
          }
        }
        
        return next;
      });
    }, 30000);
    
    return () => clearTimeout(timeout);
  }, []);
  
  return {
    optimisticMap,
    setOptimistic,
    confirmOptimistic,
    revertOptimistic,
  };
}
```

### 3.3 useCoordinationFilters

```typescript
// coordination/hooks/useCoordinationFilters.ts

interface Filters {
  search: string;
  cities: string[];
  types: string[];
  critical: boolean;
}

/**
 * Manages coordination filters with sessionStorage persistence.
 * Filters are PREFERENCES only, never persisted for data.
 */
export function useCoordinationFilters(dateKey: string) {
  const sessionKey = `coordination_filters_${dateKey}`;
  
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      return saved ? JSON.parse(saved) : {
        search: '',
        cities: [],
        types: [],
        critical: false,
      };
    } catch {
      return {
        search: '',
        cities: [],
        types: [],
        critical: false,
      };
    }
  });
  
  // Persist to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(filters));
    } catch (err) {
      console.warn('Could not save filters to sessionStorage:', err);
    }
  }, [filters, sessionKey]);
  
  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);
  
  const toggleCity = useCallback((city: string) => {
    setFilters(prev => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter(c => c !== city)
        : [...prev.cities, city],
    }));
  }, []);
  
  const toggleType = useCallback((type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  }, []);
  
  const toggleCritical = useCallback((critical: boolean) => {
    setFilters(prev => ({ ...prev, critical }));
  }, []);
  
  const clearAll = useCallback(() => {
    setFilters({
      search: '',
      cities: [],
      types: [],
      critical: false,
    });
  }, []);
  
  return {
    filters,
    setSearch,
    toggleCity,
    toggleType,
    toggleCritical,
    clearAll,
  };
}

/**
 * Applies filters to work order list.
 * Memoized for performance.
 */
export function useFilteredWorkOrders(
  workOrders: WorkOrder[],
  filters: Filters
) {
  return useMemo(() => {
    return workOrders.filter(wo => {
      // 1. Search: ID, client, address
      if (filters.search.length > 0) {
        const search = filters.search.toLowerCase();
        const matches =
          String(wo.id).includes(search) ||
          (wo.client_name?.toLowerCase().includes(search) ?? false) ||
          (wo.address?.toLowerCase().includes(search) ?? false);
        if (!matches) return false;
      }
      
      // 2. Cities
      if (filters.cities.length > 0) {
        const cityMatch = filters.cities.some(city =>
          wo.address?.includes(city)
        );
        if (!cityMatch) return false;
      }
      
      // 3. Types
      if (filters.types.length > 0) {
        if (!filters.types.includes(wo.ot_type)) return false;
      }
      
      // 4. Critical
      if (filters.critical) {
        if (!wo.is_critical) return false; // Assuming field exists
      }
      
      return true;
    });
  }, [workOrders, filters]);
}
```

---

## 4. PSEUDOCÓDIGO: handleDrop() MEJORADO

```typescript
async function handleDrop(e: DragEvent, teamId: number) {
  e.preventDefault();
  
  try {
    // ============ VALIDACIÓN LOCAL (RÁPIDO) ============
    const wo = parseDragData(e);
    if (!wo) throw new Error('Invalid drag data');
    
    const newTime = calculateNewTime(e);
    
    // Validar colisión LOCAL (antes de optimistic)
    if (hasLocalCollision(teamId, newTime, wo)) {
      setError('❌ Colisión: posición ocupada');
      return;
    }
    
    // ============ OPTIMISTIC UPDATE (INMEDIATO) ============
    const optimisticWO = {
      ...wo,
      team_id: teamId,
      scheduled_start: newTime,
      estimated_duration: wo.estimated_duration,
    };
    
    // 1. Mostrar cambio inmediatamente
    setOptimistic(optimisticWO);
    
    // 2. Mostrar UI indicator
    setIsAssigning(true);
    
    // ============ BACKEND UPDATE (ASYNC) ============
    const response = await api.patch(
      `/v2/work-orders/${wo.id}/assign`,
      {
        team_id: teamId,
        scheduled_start: newTime,
        estimated_duration: wo.estimated_duration,
      }
    );
    
    // ============ CONFIRMACIÓN vs REVERT ============
    if (response.status === 200) {
      // ÉXITO: Backend acepta
      confirmOptimistic(wo.id);
      // Siguiente polling traerá datos confirmados
      
    } else if (response.status === 409) {
      // CONFLICTO: Otra OT/usuario ya asignó
      revertOptimistic(wo.id, 'Conflicto de colisión');
      setError('❌ Otra OT ocupa esa posición ahora');
      
    } else if (response.status === 422) {
      // VALIDACIÓN: Datos inválidos
      revertOptimistic(wo.id, response.data.detail);
      setError(`❌ ${response.data.detail}`);
      
    } else {
      // ERROR: Server error
      revertOptimistic(wo.id, 'Error del servidor');
      setError('❌ Error al asignar');
    }
    
  } catch (err) {
    // EXCEPCIÓN: Network, parse error, etc
    revertOptimistic(wo.id, err.message);
    setError(`❌ ${err.message}`);
    
  } finally {
    setIsAssigning(false);
  }
}
```

---

## 5. RENDER LOGIC (PSEUDOCÓDIGO)

```jsx
function ImprovedCoordinationGrid({
  teams,
  workOrders,     // Datos BD (canónicos)
  filters,
  optimisticMap,  // Map<woId, OptimisticEntry>
  currentDate,
  activeTimeBlock,
}) {
  // ============ FILTRAR DATOS ============
  const filteredWorkOrders = useFilteredWorkOrders(
    workOrders,
    filters
  );
  
  // ============ COMPUTAR DISPLAY DATA ============
  // Mix canonical + optimistic
  const displayData = useMemo(() => {
    const result = [...filteredWorkOrders];
    
    for (const [woId, entry] of optimisticMap.entries()) {
      const idx = result.findIndex(wo => wo.id === woId);
      
      if (idx >= 0) {
        // Replace with optimistic version
        result[idx] = {
          ...entry.workOrder,
          _isOptimistic: true,
          _isPending: entry.isPending,
        };
      } else {
        // Add optimistic (new assign from backlog)
        result.push({
          ...entry.workOrder,
          _isOptimistic: true,
          _isPending: entry.isPending,
        });
      }
    }
    
    return result;
  }, [filteredWorkOrders, optimisticMap]);
  
  // ============ AGRUPAR POR EQUIPO ============
  const allocations = useMemo(() => {
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return displayData.filter(wo => {
      if (!wo.scheduled_start) return false;
      const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
      return woDay === dayStr;
    });
  }, [displayData, currentDate]);
  
  // ============ RENDERIZAR GRID ============
  return (
    <div className="grid bg-zinc-900/20">
      {/* Header */}
      <Header teams={teams} />
      
      {/* Team rows */}
      {teams.map(team => {
        const teamWOs = allocations.filter(
          wo => wo.team_id === team.id
        );
        
        return (
          <TeamRow key={team.id}>
            {/* Team label */}
            <TeamLabel team={team} />
            
            {/* Grid container */}
            <GridContainer 
              onDrop={(e) => handleDrop(e, team.id)}
            >
              {/* WO Cards */}
              {teamWOs.map(wo => (
                <DraggableWorkOrderCard
                  key={wo.id}
                  workOrder={wo}
                  isOptimistic={wo._isOptimistic}
                  isPending={wo._isPending}
                  isDragging={draggedId === wo.id}
                  onDragStart={(e) => handleDragStart(e, wo)}
                  onDragEnd={handleDragEnd}
                  onResize={(duration) => 
                    handleResize(wo.id, duration)
                  }
                  // Visual indicators if optimistic
                  className={wo._isOptimistic 
                    ? 'opacity-75 animate-pulse' 
                    : ''
                  }
                />
              ))}
            </GridContainer>
          </TeamRow>
        );
      })}
    </div>
  );
}
```

---

## 6. CLEAN-UP: LocalStorage Elimination Checklist

### Before refactor:
```javascript
// ❌ ESTAS LÍNEAS SERÁN ELIMINADAS

// ImprovedCoordinationGrid.jsx ~100-130
useEffect(() => {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const stored = localStorage.getItem(`coordination_grid_${dateKey}`);
  if (stored) {
    try {
      const storedData = JSON.parse(stored);
      setLocalWorkOrders(storedData);
      return;
    } catch (e) {
      console.error('Error restaurando...');
    }
  }
  setLocalWorkOrders(workOrders);
}, [currentDate]);

// ImprovedCoordinationGrid.jsx ~130-250 (MERGE LOGIC)
useEffect(() => {
  setLocalWorkOrders((prev) => {
    const now = Date.now();
    const freshIds = new Set(...);
    // ... 120 líneas de merge inteligente complejo ...
    return deduped;
  });
}, [workOrders]);

// ImprovedCoordinationGrid.jsx ~250-270
useEffect(() => {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  try {
    localStorage.setItem(`coordination_grid_${dateKey}`, JSON.stringify(localWorkOrders));
  } catch (e) {
    console.error('Error guardando...');
  }
}, [localWorkOrders, currentDate]);

// Refs referencias (ELIMINATED)
const lastAssignedRef = useRef(new Map());     // ❌
const [pendingAssignments, setPendingAssignments] = useState([]); // ❌

// Functions (ELIMINATED)
function markLocalAssignment(wo, snapshotOverrides = {}) { ... } // ❌
```

### After refactor:
```javascript
// ✅ CÓDIGO LIMPIO (Sin localStorage, sin merge)

function ImprovedCoordinationGrid({
  teams,
  workOrders,              // BD data directa
  filters,
  optimisticMap,          // Optimistic overlay
  currentDate,
  onDrop,                 // Callback para drag/drop
  onResize,               // Callback para resize
  onEventClick,
  activeTimeBlock,
}) {
  // ❌ Nada de useState para local data
  // ❌ Nada de localStorage
  // ❌ Nada de merge logic
  
  // ✅ Display logic sencilla
  const displayData = useMemo(() => {
    // Mix workOrders + optimisticMap
    // Apply filters
    // Return filtered + overlayed
  }, [workOrders, optimisticMap, filters]);
  
 // ✅ Render
  return <>...</>;
}
```

---

## 7. TESTING CHECKLIST (E2E)

```javascript
describe('Coordination Grid - Refactored Architecture', () => {
  
  // ========== POLLING TESTS ==========
  describe('Auto-polling with Visibility API', () => {
    test('should poll every 5s when page visible', async () => {
      // Render page
      // Mock api.get to track calls
      // Wait 10s
      // Assert: api.get called at least 2x
    });
    
    test('should stop polling when page hidden', async () => {
      // Render page
      // document.hidden = true → trigger event
      // Wait 5s
      // Assert: no new API calls
    });
    
    test('should resume polling when page visible again', async () => {
      // Hidden → visible
      // Assert: polling resumes
    });
  });
  
  // ========== OPTIMISTIC UPDATES ==========
  describe('Optimistic Update Pattern', () => {
    test('should show WO immediately when dragged', async () => {
      // Drag WO to new position
      // Assert: WO appears in new position (optimistic)
      // Assert: isOptimistic flag = true
      // Assert: UI shows pending indicator
    });
    
    test('should confirm optimistic on backend 200', async () => {
      // Drag + backend returns 200
      // Assert: optimisticMap.delete(woId)
      // Assert: UI returns to normal
    });
    
    test('should revert on backend 409 (conflict)', async () => {
      // Drag + backend returns 409
      // Assert: WO reverts to original position
      // Assert: Error toast shown
      // Assert: optimisticMap.delete(woId)
    });
    
    test('should revert after 30s timeout', async () => {
      // Mock network delay > 30s
      // Assert: Auto-revert after timeout
    });
  });
  
  // ========== FILTER TESTS ==========
  describe('Coordination Filters', () => {
    test('should filter by search (ID, client, address)', () => {
      // Set search = "100"
      // Assert: only WO with ID containing "100"
      
      // Set search = "Casa Verde"
      // Assert: only WO with client = "Casa Verde"
    });
    
    test('should persist filters to sessionStorage', () => {
      // Set cities = ["CABA", "La Plata"]
      // Reload page
      // Assert: filters restored
    });
    
    test('should clear all filters', () => {
      // Apply filters
      // Click "Clear All"
      // Assert: all filters reset
      // Assert: sessionStorage updated
    });
  });
  
  // ========== CONCURRENCY TESTS ==========
  describe('Concurrent Users / Race Conditions', () => {
    test('should handle two assigns to same position', async () => {
      // Simulate: User A drag WO#1 to 08:00 Team A
      //           User B drag WO#2 to 08:00 Team A
      // User A backend: 200 OK
      // User B backend: 409 Conflict
      // Assert: User A sees WO#1
      // Assert: User B sees error, WO#2 reverts
      // Assert: Polling brings truth from BD
    });
    
    test('should handle resize conflict', async () => {
      // WO duration 60min at 08:00-09:00
      // User A: resize to 90min
      // User B: (simultaneously) assigns WO to 08:45-09:15
      // One succeeds, one gets 409
      // Assert: Correct resolution
    });
  });
  
  // ========== INTEGRATION TESTS ==========
  describe('Full User Flow', () => {
    test('complete workflow: filter → drag → execute', async () => {
      // 1. Page loads
      // 2. User selects city filter "CABA"
      // 3. User drags WO to Team A, morning
      // 4. Backend accepts
      // 5. Next polling updates truth
      // 6. User clicks "Ejecutar OT"
      // 7. Navigate to work-orders/123
      // 8. User returns (back button)
      // 9. Coordinación reloads, filters/state restored
      
      // Assertions throughout
    });
  });
});
```

---

## 8. DEPLOYMENT STRATEGY

```bash
# Step 1: Create branch
git checkout -b refactor/coordination-clean-arch

# Phase 1: Setup (no breaking changes)
git add coordination/hooks/*.ts coordination/utils/*
git commit -m "setup: create custom hooks and utilities"

# Phase 2: Integrate filters (new, non-breaking)
git commit -m "feat: integrate CoordinationFilters in page"

# Phase 3: Replace state management (BREAKING)
# This is the critical point - must be careful
git commit -m "refactor: replace localStorage with polling + optimistic"

# Phase 4: Testing & cleanup
git commit -m "test: add E2E tests for new architecture"
git commit -m "test: verify all features still work"
git commit -m "chore: remove dead localStorage code"

# Phase 5: Documentation
git commit -m "docs: update architecture guide"

# Step 2: Create PR
git push origin refactor/coordination-clean-arch
# → Create PR with detailed description

# Step 3: Review (with team)
# - Type safety
# - Performance impact
# - Memory leaks
# - Error handling

# Step 4: Merge
git merge --squash refactor/coordination-clean-arch
# OR keep individual commits for traceability

# Step 5: Tag release
git tag coordination-cleanup-24feb2026-final
git push origin coordination-cleanup-24feb2026-final
```

---

## 9. SUMMARY TABLE

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Source of Truth** | 5 states (BD, state, localStorage, refs, pending) | 1 state (BD) |
| **State Syncing** | Merge inteligente (120 líneas) | Optimistic overlay (simple) |
| **Polling** | 3s, always running | 5s, pauses if page hidden |
| **Data Persistence** | localStorage + sessionStorage | sessionStorage (UI prefs only) |
| **Recovery on reload** | localStorage (stale) | Fresh from BD |
| **User responsiveness** | Wait for backend | Immediate (optimistic) |
| **Error handling** | Complex revert logic | Simple auto-revert |
| **Filter integration** | Not integrated | Fully integrated |
| **Lines of code (Grid)** | 979 | ~600 (fewer responsibilities) |
| **Maintainability** | ⚠️ Complex | ✅ Simple |
| **Debuggability** | ❌ Hard (many moving parts) | ✅ Easy (linear flow) |

