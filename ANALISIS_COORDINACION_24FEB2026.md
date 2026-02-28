# Análisis Técnico Exhaustivo - Módulo de Coordinación Emerald ERP
**Fecha:** 24 de febrero de 2026  
**Autor:** GitHub Copilot (Análisis Arquitectónico)  
**Estatus:** CRÍTICO - Se detectan desincronizaciones BD-Frontend  

---

## 1. DIFF DETALLADO: 4513e16 → HEAD

### 1.1 Estadísticas de Cambios
```
Archivos modificados: 4
Archivos nuevos: 2
Total insertado: 1000 líneas
Total eliminado: 208 líneas
```

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `CoordinationFilters.jsx` | **NUEVO** | +211 |
| `CoordinationSheet.jsx` | **NUEVO** | +433 |
| `CoordinationSidebar.jsx` | MODIFICADO | +207/-208 |
| `DraggableWorkOrderCard.jsx` | MODIFICADO | +357/-0 |
| `ImprovedCoordinationGrid.jsx` | **SIN CAMBIOS** | 0 |
| `CoordinationGridPage.jsx` | **SIN CAMBIOS** | 0 |

### 1.2 Análisis por Commit (4513e16 → HEAD)

#### **Commit 9ce493c** (Baseline - Tactical View)
```
feat(coordination): implementar DraggableWorkOrderCard Tactical View
- Compactación de tarjetas a 48-54px altura
- Layout táctica para maximizar densidad visual
- Introducción de refs para detectar resize en tiempo real
```

#### **Commits 56a691c → 45fbd47** (Visual Upgrades)
```
UX Improvements:
  - Rich Tooltip con metadata operacional (tipo, fecha)
  - Duración en display de tooltip
  - Limpieza de datos mostrados (solo operacionales)
```

#### **Commits 85996b9 → 4c65a29** (Backend Integration v1)
```
feat: contact_details → contact_info (schema fix)
feat: include full ticket in work_order response
feat: contact attempts tracking
feat: CoordinationSheet (sidebar de detalles)
feat: city filter + prominent phone button
```

#### **Commits cbc5fcf → d3a48b1** (NUEVO: CoordinationFilters)
```
feat: Implementar CoordinationFilters y lógica multicriterio
  - Búsqueda universal (ID, cliente, dirección)
  - Filtro de localidades (extrae de conexiones reales)
  - Filtro de tipos de OT (Reparación, Instalación)
  - Toggle de OTs críticas
  - Integración con LocalStorage para persistencia de filtros
  
fix: Extraer ciudades REALES de conexiones (no hardcodeados)

refactor: Mejorar UI de desplegable de Localidades
  - Checkboxes con count badges
  - Diseño scrollable para muchas ciudades
  - Badge de filtros activos
```

---

## 2. FUNCIONALIDADES NUEVAS (POST-4513e16)

### 2.1 CoordinationFilters.jsx (211 líneas)
**Propósito:** Sistema multicriterio para reducir ruido visual.

**Características:**
- ✅ Búsqueda universal por ID/cliente/dirección
- ✅ Filtro de localidades dinámico (extrae ciudades de `work_orders[].address`)
- ✅ Filtro de tipos de OT (`repair`, `install`, `pickup`, `infrastructure`)
- ✅ Toggle para mostrar solo OTs críticas
- ✅ Limpieza de filtros (botón "Clear All")
- ✅ LocalStorage para persistencia entre sesiones

**Props esperadas:**
```jsx
{
  filters: { search, cities: [], types: [], critical: false },
  availableCities: string[],
  onSearchChange: (search: string) => void,
  onCitiesChange: (city: string) => void,
  onTypesChange: (type: string) => void,
  onCriticalChange: (critical: boolean) => void,
  onClearAll: () => void
}
```

**Integración:**
```javascript
// EN CoordinationGridPage (ACTUAL NO ESTÁ INTEGRADO)
// Falta: pasar filters state y handlers a ImprovedCoordinationGrid
// Falta: ImportarCoordinationFilters en CoordinationGridPage
```

### 2.2 CoordinationSheet.jsx (433 líneas)
**Propósito:** Sidebar de detalles enriquecido para OT seleccionada.

**Features:**
- ✅ Metadata completa de OT (cliente, dirección, teléfono)
- ✅ Contact info con botón "Llamar" prominente
- ✅ Historial de intentos de contacto
- ✅ Timeline de cambios de estado
- ✅ Acceso rápido a sistemas externos (Google Maps, WhatsApp)
- ✅ Botones de acción (Ejecutar OT, Devolver al Backlog)

**Observación CRÍTICA:**
```javascript
// CoordinationSheet.jsx usa DetailSheet inline en CoordinationGridPage
// CoordinationSheet.jsx aparece como NUEVO pero no se ve importado
// ¿Se está usando? Necesita verificación
```

### 2.3 DraggableWorkOrderCard.jsx (357 líneas de cambios)
**Cambios principales:**
- ✅ Compactación de altura (48-54px → máxima densidad)
- ✅ Rich Tooltip dinámico durante drag
- ✅ Metadata visual reducida (solo operacionales)
- ✅ Indicadores de estado visuales (colores, iconos)
- ✅ Layout responsive para diferentes resoluciones

### 2.4 CoordinationSidebar.jsx (207 líneas de cambios)
**Cambios:**
- ✅ Refactorización significativa de layout
- ✅ Integración con nuevo sistema de detalles
- ✅ Mejor display de backlog
- ✅ Acciones rápidas mejoradas

---

## 3. ARQUITECTURA ACTUAL: PROBLEMAS IDENTIFICADOS

### 3.1 **Problema Crítico #1: localStorage ↔ BD Desincronización**

#### Síntoma:
```javascript
// CoordinationGridPage.jsx - línea ~160
useEffect(() => {
  const interval = setInterval(() => {
    loadCoordinationGrid(); // Polling cada 3 segundos
  }, 3000);
  return () => clearInterval(interval);
}, [currentDate]);
```

**Concurrencia de datos:**
```
┌─────────────────────────────────────────────────────────────┐
│ FLUJO ACTUAL (PROBLEMÁTICO)                                 │
├─────────────────────────────────────────────────────────────┤
│ T=0s   Usuario carga CoordinationGridPage                  │
│        → loadCoordinationGrid() → GET /coordination/grid    │
│        → setGridData(response.data)                          │
│        → ImprovedCoordinationGrid renderiza con datos BD   │
│                                                              │
│ T=1s   Usuario arrastra OT → handleDrop() ejecuta:         │
│        → API PATCH /work-orders/{id}/assign                 │
│        → setLocalWorkOrders() con optimistic update        │
│        → localStorage.setItem() para persistencia           │
│        → markLocalAssignment() para tracking local          │
│                                                              │
│ T=2s   Usuario navega fuera (ejemplo: /tickets/123)        │
│        → Componente unmount                                │
│        → localStorage MANTIENE datos de OT anterior        │
│                                                              │
│ T=3s   Polling backend trae NEW DATA:                       │
│        → Pero usuario NO está viendo coordinación          │
│        → localStorage tiene versión VIEJA                  │
│                                                              │
│ T=5s   Usuario regresa a /coordination                     │
│        → useEffect restaura de localStorage                 │
│        → setLocalWorkOrders(storedData) ← VERSIÓN VIEJA   │
│        → Merge inteligente intenta reconciliar pero...      │
│        → lastAssignedRef.current queda VACÍO (nuevo mount) │
│        → Resultado: INCONSISTENCIA                         │
│                                                              │
│ PROBLEMA: localStorage es "snapshot" PUNTO EN TIEMPO       │
│           BD evoluciona mientras usuario está en otra página│
│           localStorage + polling = race condition          │
└─────────────────────────────────────────────────────────────┘
```

#### Root Cause:
- `localStorage.setItem()` guarda estado LOCAL en T=1s
- Backend sigue evolucionando independientemente en T=2-4s
- Al volver, localStorage trae versión de T=1s, no T=4s
- Polling se ejecuta pero los datos restaurados de localStorage sobrescriben el fetch limpio

---

### 3.2 **Problema Crítico #2: Merge Inteligente Sobrecomplejo**

#### Código problemático (ImprovedCoordinationGrid.jsx, ~línea 130):
```javascript
useEffect(() => {
  // Merge inteligente: LÓGICA MUY COMPLEJA
  setLocalWorkOrders((prev) => {
    const now = Date.now();
    const freshIds = new Set(...); // IDs que vinieron del backend
    
    // 1. Limpiar lastAssignedRef de entradas viejas (GRACE_MS timeout)
    // 2. Computar orphaned: OTs locales sin match en backend
    // 3. Hacer recentSnapshots: OTs no en backend pero en memory
    // 4. Deduplicar por getWorkOrderKey() 
    // 
    // = RESULTADO: Array de 3 orígenes mezclados
    const merged = [...recentSnapshots, ...workOrders, ...orphaned];
    const deduped = merged.filter((wo) => {
      const key = getWorkOrderKey(wo);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return deduped;
  });
}, [workOrders]);
```

#### Problemas:
1. **Complejidad exponencial:** 3 estados concurrentes (backend, local, "grace period")
2. **Race conditions:** ASSIGNMENT_GRACE_MS (2 minutos) puede solaparse con siguientes assigns
3. **Fallback frágil:** `getWorkOrderKey()` usa concat de strings (cliente|dirección|fecha)
   - Campos pueden tener espacios/caracteres especiales
   - Dos OTs genuinamente idénticas (mismo cliente, misma dirección) → FALSE POSITIVE
4. **Difícil debuggear:** Console logs extensos pero sin traza clara de "quién gana en conflicto"
5. **Costo computacional:** Deduplicación O(n²) en cada render

---

### 3.3 **Problema Crítico #3: Estado Local No Persiste Tras Navegación Exterior**

```javascript
// CoordinationGridPage.jsx - ESTRUCTURA ACTUAL
export default function CoordinationGridPage() {
  const [currentDate, setCurrentDate] = useState(new Date()); // Perdido
  const [gridData, setGridData] = useState(null); // Perdido
  const [isLoading, setIsLoading] = useState(true); // Perdido
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null); // Perdido
  const [activeTimeBlock, setActiveTimeBlock] = useState('morning'); // Perdido
  // ...
  
  // Al hacer navigate('/work-orders/123'), TODO SE PIERDE
}
```

#### Escenario:
```
Usuario selecciona OT en coordinación → Ve detalles → Hace clic "Ejecutar OT"
→ navigate('/work-orders/123')
→ Completa trabajo
→ Usa botón atrás del navegador
→ Vuelve a /coordination
→ TODO el estado se resetea
→ Pierde: filtros aplicados, OT seleccionada, turno (mañana/tarde), scroll position
```

#### Consecuencia actual:
- localStorage "guarda" datos, pero solo de OTs
- NO guarda: filtros, selección, turno activo, scroll
- Experiencia UX degradada

---

### 3.4 **Problema #4: Falta Polling Automático o Es Insuficiente**

**Situación actual:**
```javascript
// CoordinationGridPage.jsx línea ~160
useEffect(() => {
  const interval = setInterval(() => {
    loadCoordinationGrid(); // Cada 3 segundos
  }, 3000);
  return () => clearInterval(interval);
}, [currentDate]);
```

**Problemas:**
- ✅ Sí hay polling (bueno)
- ❌ Pero se ejecuta **incluso cuando el usuario está viendo otra página**
  - 3 segundos × infinito = desperdicio de ancho de banda + CPU
- ❌ Batalla con localStorage:
  - Polling trae datos NUEVOS de BD
  - Pero localStorage restauró datos VIEJOS
  - Merge inteligente intenta reconciliar → LENTITUD

---

### 3.5 **Problema #5: Ausencia de CoordinationFilters en CoordinationGridPage**

**Componente existe:** ✅ CoordinationFilters.jsx (211 líneas)  
**Está integrado:** ❌ NO SE IMPORTA en CoordinationGridPage

```javascript
// CoordinationGridPage.jsx - ACTUAL
import ImprovedCoordinationGrid from '@/components/coordination/ImprovedCoordinationGrid';
// Falta: import CoordinationFilters from '@/components/coordination/CoordinationFilters';

export default function CoordinationGridPage() {
  // Falta: [filters, setFilters] = useState(...)
  // Falta: handlers para filtros
  // Falta: <CoordinationFilters ... />
  // Falta: pasar filters a ImprovedCoordinationGrid
  // Falta: aplicar filtros en el grid
}
```

**Impacto:** Funcionalidad desarrollada pero INACTIVA

---

## 4. RAÍZ DE LOS PROBLEMAS: Arquitectura Dual Source of Truth

```
┌──────────────────────────────────────────────────────────────────┐
│ ARQUITECTURA ACTUAL (ANTI-PATTERN)                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FRONTEND STATE MANAGEMENT                              │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ gridData (useState)      ← Backend data (3s old)       │   │
│  │ localWorkOrders (useState) ← Optimistic + localStorage │   │
│  │ localStorage            ← Snapshot point-in-time       │   │
│  │ lastAssignedRef         ← Grace period tracking        │   │
│  │ pendingAssignments      ← "Anti-disappearance" queue  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↕↕↕ CONFLICTIVA ↕↕↕                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BACKEND STATE (PostgreSQL)                             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ work_orders table      ← Verdad absoluta              │   │
│  │ work_order_events      ← Auditoría completa           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│ PROBLEMA: 5 STATES DIFERENTES = 5 FUENTES DE VERDAD POTENCIALES│
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. PROPUESTA DE ARQUIT ECTURa LIMPIA: Single Source of Truth (BD)

### 5.1 Principios NASA-Grade

```
┌────────────────────────────────────────────────────────────────┐
│ ARQUITECTURA PROPUESTA: BD COMO SINGLE SOURCE OF TRUTH         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL (work_orders, work_order_events)             │ │
│  │ ← SINGLE SOURCE OF TRUTH                                │ │
│  │ ← Auditoría completa en eventos                         │ │
│  │ ← Recuperable en cualquier momento                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│         ↑                                                      │
│         │ API respuestas AUTORITATIVAS                        │
│         ↓                                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ FRONTEND CACHE (React State + sessionStorage)           │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ coordinationState = {                                    │ │
│  │   data: { teams, allocations, backlog }  ← BD copy      │ │
│  │   filters: { search, cities, types, ... }               │ │
│  │   ui: { currentDate, activeTimeBlock, ... }             │ │
│  │   syncedAt: timestamp                                   │ │
│  │ }                                                         │ │
│  │                                                           │ │
│  │ optimisticUpdates = Map<woId>  ← Temporal durante sync  │ │
│  └──────────────────────────────────────────────────────────┘ │
│         ↑                                                      │
│         │ Polling 5s + Optimistic updates                     │
│         │ Validación antes de mostrar                         │
│         ↓                                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ USER INTERFACE                                           │ │
│  │ - Renderiza coordinationState.data (BD)                 │ │
│  │ - Sobrepone optimisticUpdates si existen                │ │
│  │ - Actualiza en tiempo real al sincronizar               │ │
│  │ - Mantiene filtros y UI state localmente                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ GARANTÍAS:                                                    │
│ ✅ BD siempre es fuente de verdad                             │
│ ✅ Frontend es cache + UI state (no persistente)              │
│ ✅ Sin localStorage para datos críticos                       │
│ ✅ sessionStorage solo para preferencias UI (filtros, turno) │
│ ✅ Recuperable al recargar página (datos siempre en BD)      │
│ ✅ Transacciones ACID en backend                             │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Componentes de la Solución

#### **5.2.1 API Polling Thread (CoordinationGridPage)**
```javascript
// Polling automático e inteligente
useEffect(() => {
  // Detectar si estamos en esta página (mediante Visibility API)
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Stop polling si página está oculta
      clearInterval(pollingInterval);
    } else {
      // Resume polling si página es visible
      startPolling();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Polling SOLO mientras página es visible
  const pollingInterval = setInterval(() => {
    refreshCoordinationData(); // GET /coordination/grid
  }, 5000); // 5 segundos = balance entre reactividad y ancho de banda
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(pollingInterval);
  };
}, [currentDate]);
```

**Ventajas:**
- ✅ Detiene polling si usuario cambia de tab
- ✅ Resume si vuelve
- ✅ Reduce desperdicio de bandwidth
- ✅ Batería más duradera en móviles

#### **5.2.2 Optimistic Updates Pattern**
```javascript
// ImprovedCoordinationGrid.jsx - handleDrop mejorado

async function handleDrop(e, teamId) {
  try {
    // PASO 1: Preparar datos
    const newScheduledStart = calculateNewTime(e, teamId);
    
    // PASO 2: Validar colisiones LOCALES (rápido)
    if (hasLocalCollision(teamId, newScheduledStart)) {
      setError('❌ Colisión detectada');
      return;
    }
    
    // PASO 3: Optimistic update (mostrar inmediatamente)
    const optimisticWO = {
      ...wo,
      team_id: teamId,
      scheduled_start: newScheduledStart,
      estimated_duration: wo.estimated_duration,
    };
    optimisticUpdatesRef.current.set(wo.id, optimisticWO);
    triggerUIUpdate(); // Re-render inmediato
    
    // PASO 4: Enviar a backend (async)
    const response = await api.patch(
      `/v2/work-orders/${wo.id}/assign`,
      {
        team_id: teamId,
        scheduled_start: newScheduledStart,
        estimated_duration: wo.estimated_duration,
      }
    );
    
    // PASO 5: Confirmar con respuesta del backend
    if (response.ok) {
      // Backend confirmó, quitar de optimistic
      optimisticUpdatesRef.current.delete(wo.id);
      // Siguiente polling traerá datos canónicos
    } else {
      // Backend rechazó, revertir UI
      optimisticUpdatesRef.current.delete(wo.id);
      triggerUIUpdate();
      setError(`❌ Error: ${response.data.detail}`);
    }
  } catch (err) {
    // En caso de error: revertir optimistic
    optimisticUpdatesRef.current.delete(wo.id);
    triggerUIUpdate();
    setError(`❌ Error: ${err.message}`);
  }
}

// En el render:
function renderWorkOrder(wo) {
  const optimistic = optimisticUpdatesRef.current.get(wo.id);
  const displayData = optimistic || wo; // Mostrar optimistic si existe
  
  return (
    <DraggableWorkOrderCard
      {...displayData}
      isOptimistic={!!optimistic}
      className={optimistic ? 'opacity-75 animate-pulse' : ''}
    />
  );
}
```

**Ventajas:**
- ✅ UI responde INSTANTÁNEAMENTE (no espera backend)
- ✅ Si backend falla, se revierte automáticamente
- ✅ Usuario ve el cambio inmediatamente, no nota latencia
- ✅ Transiciones animadas suaves

#### **5.2.3 sessionStorage para Estado UI (No Datos)**
```javascript
// Persistencia ligera de preferencias, NO datos críticos

useEffect(() => {
  // Guardar filtros y preferencias en sessionStorage
  const uiState = {
    filters: { search, cities, types, critical },
    activeTimeBlock,
    selectedWorkOrderId,
    sortBy,
  };
  sessionStorage.setItem(
    `coordination_ui_${format(currentDate, 'yyyy-MM-dd')}`,
    JSON.stringify(uiState)
  );
}, [filters, activeTimeBlock, selectedWorkOrderId, sortBy, currentDate]);

// Restaurar al cargar
useEffect(() => {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const saved = sessionStorage.getItem(`coordination_ui_${dateKey}`);
  if (saved) {
    const uiState = JSON.parse(saved);
    setFilters(uiState.filters);
    setActiveTimeBlock(uiState.activeTimeBlock);
    // etc...
  }
}, [currentDate]); // Solo al cambiar fecha
```

**Importante:**
- sessionStorage = Por pestaña/sesión (se limpia al cerrar)
- localStorage = Global (permanece entre sesiones)
- ✅ Datos BD NUNCA en storage local
- ✅ Pero UI preferences SÍ, para mejor UX

#### **5.2.4 Limpieza de localStorage Antiguo**
```javascript
// En CoordinationGridPage useEffect cleanup
useEffect(() => {
  // Limpiar datos OLD de localStorage (más de 1 hora)
  const today = format(new Date(), 'yyyy-MM-dd');
  for (let key of Object.keys(localStorage)) {
    if (key.startsWith('coordination_grid_')) {
      const dateStr = key.replace('coordination_grid_', '');
      const date = parseISO(dateStr);
      const age = Date.now() - date.getTime();
      if (age > 3600000) { // 1 hora
        localStorage.removeItem(key);
      }
    }
  }
}, []); // Una vez al cargar componente
```

---

## 6. PLAN DE REFACTOR PASO A PASO (SIN PERDER NADA)

### 6.1 FASE 1: Preparación (1-2 horas)

**Objetivo:** Setup de nuevas estructuras sin cambiar flujo actual

```bash
# 1.1 Backup del estado actual
git branch -D backup-24feb2026 2>/dev/null || true
git branch backup-24feb2026
git push origin backup-24feb2026

# 1.2 Crear rama de desarrollo
git checkout -b refactor/coordination-architecture

# 1.3 Preparar nuevas props/interfaces
```

**Checklist:**
- [ ] Crear archivo `coordination/hooks/useCoordinationSync.js`
- [ ] Crear archivo `coordination/hooks/useOptimisticUpdates.js`
- [ ] Crear archivo `coordination/types/coordination.d.ts` (TypeScript definitions)
- [ ] Crear archivo `coordination/utils/coordinationHelpers.js`
- [ ] Revisar y documentar endpoint `/v2/work-orders/coordination/grid`

**Archivos a crear:**
```javascript
// coordination/hooks/useCoordinationSync.js
export function useCoordinationSync(currentDate, enabled = true) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastSyncRef = useRef(null);
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      // Implementar lógica de polling visual
    };
    
    // Polling inteligente aquí
    // ...
  }, [currentDate, enabled]);
  
  return { data, isLoading, error, refetch: () => {...} };
}
```

### 6.2 FASE 2: Integración CoordinationFilters (1 hora)

**Objetivo:** Activar componente CoordinationFilters que ya existe

```javascript
// CoordinationGridPage.jsx - MODIFICAR

import CoordinationFilters from '@/components/coordination/CoordinationFilters';

export default function CoordinationGridPage() {
  const [filters, setFilters] = useState(() => {
    const stored = sessionStorage.getItem('coordination_filters');
    return stored ? JSON.parse(stored) : {
      search: '',
      cities: [],
      types: [],
      critical: false,
    };
  });
  
  useEffect(() => {
    sessionStorage.setItem('coordination_filters', JSON.stringify(filters));
  }, [filters]);
  
  // ... 
  
  return (
    <div className="flex h-screen bg-zinc-950">
      <CoordinationSidebar {...props} />
      <div className="flex-1 flex flex-col">
        <Header {...props} />
        
        {/* NUEVO: Agregar CoordinationFilters */}
        <CoordinationFilters
          filters={filters}
          availableCities={gridData?.availableCities || []}
          onSearchChange={(search) => setFilters(f => ({...f, search}))}
          onCitiesChange={(city) => setFilters(f => ({
            ...f,
            cities: f.cities.includes(city)
              ? f.cities.filter(c => c !== city)
              : [...f.cities, city]
          }))}
          onTypesChange={(type) => {...}}
          onCriticalChange={(critical) => {...}}
          onClearAll={() => setFilters({
            search: '', cities: [], types: [], critical: false
          })}
        />
        
        {/* Grid con filtros aplicados */}
        <ImprovedCoordinationGrid
          {...props}
          filters={filters}  {/* NUEVO */}
        />
      </div>
    </div>
  );
}
```

**Tiempo:**
- [ ] Integrar CoordinationFilters en CoordinationGridPage
- [ ] Pasar filters a ImprovedCoordinationGrid
- [ ] Implementar lógica de filtrado en ImprovedCoordinationGrid.jsx
- [ ] Testearel filtro de ciudades con datos reales
- [ ] Testear filtro de tipos
- [ ] Verificar persistencia en sessionStorage

---

### 6.3 FASE 3: Reemplazar localStorage con Polling Inteligente (2-3 horas)

**Objetivo:** Remover localStorage, implementar polling desde CoordinationGridPage

**Cambios en CoordinationGridPage.jsx:**
```javascript
// ANTES
const [gridData, setGridData] = useState(null);
const [activeTimeBlock, setActiveTimeBlock] = useState('morning');

useEffect(() => {
  loadCoordinationGrid();
}, [currentDate]);

useEffect(() => {
  const interval = setInterval(() => {
    loadCoordinationGrid();
  }, 3000);
  return () => clearInterval(interval);
}, [currentDate]);

async function loadCoordinationGrid() {
  try {
    const response = await api.get('/v2/work-orders/coordination/grid', {
      params: { start_date: formatDate(currentDate) }
    });
    setGridData(response.data);
  } catch (err) {
    setError(err.message);
  }
}

// DESPUÉS
const { data: gridData, isLoading, error, refetch } = useCoordinationSync(
  currentDate,
  true // enabled
);

// Ya no hay setInterval, todo en hook
```

**Cambios en ImprovedCoordinationGrid.jsx:**

```javascript
// ANTES
const [localWorkOrders, setLocalWorkOrders] = useState(workOrders);
const [draggedItem, setDraggedItem] = useState(null);
const lastAssignedRef = useRef(new Map());
const [pendingAssignments, setPendingAssignments] = useState([]);

// Restaurar de localStorage
useEffect(() => {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const stored = localStorage.getItem(`coordination_grid_${dateKey}`);
  if (stored) {
    setLocalWorkOrders(JSON.parse(stored));
  } else {
    setLocalWorkOrders(workOrders);
  }
}, [currentDate]);

// Merge inteligente (COMPLEJO)
useEffect(() => {
  setLocalWorkOrders((prev) => {
    // Lógica muy compleja aquí...
  });
}, [workOrders]);

// Guardar en localStorage
useEffect(() => {
  localStorage.setItem(
    `coordination_grid_${dateKey}`,
    JSON.stringify(localWorkOrders)
  );
}, [localWorkOrders, currentDate]);

// DESPUÉS
const optimisticUpdatesRef = useRef(new Map());

// Simplemente: usar workOrders del backend
// NO localStorage
// NO merge inteligente

// displayWorkOrders = computed value que mezcla workOrders + optimistic
const displayWorkOrders = useMemo(() => {
  const result = [...workOrders];
  
  // Sobreponer optimistic updates
  for (const [woId, optimistic] of optimisticUpdatesRef.current) {
    const idx = result.findIndex(wo => wo.id === woId);
    if (idx >= 0) {
      result[idx] = optimistic;
    } else {
      result.push(optimistic);
    }
  }
  
 return result;
}, [workOrders]);

// Usar displayWorkOrders en renders
const allocations = useMemo(() => {
  // Filtrar displayWorkOrders por fecha y timeblock
  return displayWorkOrders.filter(wo => {
    // ...
  });
}, [displayWorkOrders, currentDate, activeTimeBlock]);
```

**Checklist FASE 3:**
- [ ] Eliminar localStorage de ImprovedCoordinationGrid
- [ ] Eliminar lastAssignedRef, pendingAssignments y merge logic
- [ ] Implementar useCoordinationSync hook
- [ ] Implementar optimisticUpdatesRef simple
- [ ] Testear drag & drop con optimistic update
- [ ] Testear revert si backend falla
- [ ] Testear polling automático
- [ ] Verificar memory leaks (cleanup intervals)
- [ ] Testearperfomance con 100+ OTs

---

### 6.4 FASE 4: Persistencia de Estado UI (sessionStorage)  (1 hora)

**Objetivo:** Guardar y restaurar filtros, turno, scroll, selección

```javascript
// CoordinationGridPage.jsx

const sessionKey = `coordination_session_${format(currentDate, 'yyyy-MM-dd')}`;

useEffect(() => {
  const saved = sessionStorage.getItem(sessionKey);
  if (saved) {
    const { filters: savedFilters, activeTimeBlock: savedTimeBlock } = JSON.parse(saved);
    setFilters(savedFilters);
    setActiveTimeBlock(savedTimeBlock);
  }
}, []);

useEffect(() => {
  const state = { filters, activeTimeBlock };
  sessionStorage.setItem(sessionKey, JSON.stringify(state));
}, [filters, activeTimeBlock]);
```

**Checklist FASE 4:**
- [ ] Guardar filtros en sessionStorage
- [ ] Guardar activeTimeBlock
- [ ] Guardar selectedWorkOrderId (para restaurar detail sheet)
- [ ] Guardar gridScroll position (si hay scroll horizontal)
- [ ] Testear nav cerrar/abrir → restaurar estado
- [ ] Verificar que sessionStorage se limpia al cerrar pestaña
- [ ] NO guardar datos de OTs (solo en BD)

---

### 6.5 FASE 5: Testing E2E (2-3 horas)

**Escenarios críticos:**

#### Escenario 1: Drag & Drop básico
```javascript
// Test: Usuario arrastra OT de backlog a equipo
Scenario: "Drag OT from backlog to morning shift"
  Given: Coordinación cargada, OT en backlog
  When: Usuario arrastra OT a equipo "Técnico A" mañana
  Then: 
    ✅ OT aparece inmediatamente en grid (optimistic)
    ✅ Spinner de "Actualizando..." 
    ✅ Backend retorna 200 OK
    ✅ Optimistic update se confirma
    ✅ Polling siguiente no duplica (dedup correcto)
```

#### Escenario 2: Conflicto de colisión
```javascript
Scenario: "Drop rejected - collision"
  Given: Dos OTs en 08:00-09:00 para equipo A
  When: Usuario intenta insertar tercera OT en ese horario
  Then:
    ✅ Validación local previene drop
    ✅ Error toast: "Colisión detectada"
    ✅ OT nunca va a optimistic
    ✅ Backend nunca vé el request
```

#### Escenario 3: Navegación exterior y vuelta
```javascript
Scenario: "Navigate outside coordination, return and state restored"
  Given: Coordinación visible, filtros aplicados (municipios), turno tarde
  When: 
    1. Usuario via coordinación
    2. Navega a /work-orders/123
    3. Completa trabajo
    4. Regresa a /coordination (botón atrás)
  Then:
    ✅ Coordinación vuelve a cargar
    ✅ Filtros restaurados (municipios seleccionados)
    ✅ activeTimeBlock es "afternoon"
    ✅ Datos BD más recientes están disponibles
    ✅ Polling resume automáticamente
```

#### Escenario 4: Resize de duración
```javascript
Scenario: "Resize OT duration with live feedback"
  Given: OT de 60min asignada a equipo
  When: Usuario arrastra borde derecho 15min a la derecha
  Then:
    ✅ Duracion muestra 75min en tiempo real (sin esperar backend)
    ✅ Tooltip muestra "08:00 - 09:15"
    ✅ Al soltar, envia PATCH a backend
    ✅ Backend valida colisión
    ✅ Si OK: optimistic se confirma
    ✅ Si falla: revierte a 60min, error message
```

#### Escenario 5: Múltiples usuarios (concurrencia)
```javascript
Scenario: "Concurrent assignments from two users"
  Given: Dos navegadores abiertos en coordinación (misma fecha/equipo)
  User A: Arrastra OT#100 a equipo A 08:00
  User B: Arrastra OT#200 a equipo A 08:00
  Then:
    ✅ User A ve OT#100 en grid (optimistic)
    ✅ User B ve OT#200 en grid (optimistic)
    ✅ Ambos envían PATCH
    ✅ Uno sucede (200 OK), otro falla (409 Conflict)
    ✅ El que falló: error toast, local revert
    ✅ Siguiente polling sincroniza verdad
```

**Herramientas de test:**
- [ ] Vitest + React Testing Library
- [ ] Cypress para E2E
- [ ] Network throttling en DevTools para simular latencia
- [ ] MutationObserver para validar DOM updates
- [ ] console.log cleanup (remover todos los console.log de debug)

---

### 6.6 FASE 6: Limpieza y Documentación (1-2 horas)

**Checklist:**
- [ ] Remover console.log de debug
- [ ] Comentarios técnicos en código
- [ ] Docstrings en funciones críticas
- [ ] README.md actualizado con arquitectura
- [ ] Diagramas de flujo (en markdown/mermaid)
- [ ] Guía de troubleshooting
- [ ] Actualizar CHANGELOG

**Archivos a documentar:**
```markdown
# frontend/src/components/coordination/README.md

## Arquitectura

### Flujo de datos
1. CoordinationGridPage hace polling cada 5s
2. Backend retorna data canónica (BD)
3. ImprovedCoordinationGrid renderiza con optimistic overlays
4. Cuando usuario arrastra → optimisticUpdatesRef.set()
5. UI re-render inmediato (Optimistic Update)
6. Backend responde, optimisticUpdatesRef.delete() si success
7. Siguiente polling trae confirmación BD

### Archivos clave
- useCoordinationSync: Hook de polling
- useOptimisticUpdates: Hook para optimistic updates
- ImprovedCoordinationGrid: Renderizado principal
- CoordinationFilters: Filtros multicriterio (sessionStorage)

### Decisiones arquitectónicas
- ❌ localStorage para datos críticos (razón: desincronización)
- ✅ sessionStorage para preferencias UI (razón: UX, recoverable from BD)
- ✅ BD como source of truth (razón: transacciones ACID)
- ✅ Polling en CoordinationGridPage (razón: centralización)
- ✅ Optimistic updates (razón: responsiveness immediata)
```

---

## 7. FUNCIONALIDADES QUE DEBEN PRESERVARSE

### ✅ CRÍTICO - NO ELIMINAR

- **Drag & Drop fluido** - Sistema de snap a 5 minutos
- **Validación de colisiones** - Previene solapamientos
- **Resize horizontal** - Cambiar duración
- **CoordinationFilters** - Multicriterio (activar)
- **Rich Tooltips** - Metadata en operacionales
- **Tactical HUD style** - Compactación visual
- **Detail Sheet** - Sidebar de detalles
- **Sidebar Backlog** - Queue de OTs sin asignar
- **Team colors/identification** - Distinguir equipos
- **Morning/Afternoon toggle** - Cambiar turno
- **Date navigation** - Previous/Today/Next
- **Ejecutar OT button** - Navegar a work-orders
- **Devolver a Backlog** - Unassign quick action

### ⚠️ REFACTORIZABLE - CON CUIDADO

- **localStorage implementation** - Reemplazar con polling + sessionStorage
- **Merge inteligente logic** - Simplificar a optimistic + BD
- **lastAssignedRef/pendingAssignments** - Remover, usar optimisticUpdatesRef

---

## 8. RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Severidad | Mitigación |
|--------|-------------|-----------|-----------|
| **Perder cambios usuario durante refactor** | Media | CRÍTICA | Backup branch, feature flags |
| **Race conditions en polling + optimistic** | Media | Alta | Testing concurrencia, mutex pattern |
| **Memory leak en setInterval** | Baja | Media | useEffect cleanup, visibilityAPI |
| **sessionStorage incompatible algunos navegadores** | Baja | Media | Fallback a defaults si error |
| **Conflicto con CoordinationSheet sin integrar** | Media | Media | Verificar componentes huérfanos |
| **Backward compatibility con backend** | Baja | Media | Versionado API (/v2/ ya existe) |

---

## 9. RESUMEN EJECUTIVO

### Estado Actual (24 Feb 2026)
✅ **Arquitectura Base:** Sólida (drag/drop, resize, validation)  
❌ **State Management:** Crítica (localStorage + polling conflictiva)  
❌ **CoordinationFilters:** Existe pero NO integrada  
❌ **Merge inteligente:** Compleja, frágil  

### Propuesta
1. **Single Source of Truth:** BD como autoridad canónica
2. **Polling inteligente:** 5s, solo cuando página visible
3. **Optimistic updates:** Respuesta UI instantánea
4. **sessionStorage:** Solo preferencias UI
5. **Simplificación:** Remover merge logic overly complex

### Timeline Estimado
- **FASE 1 (Prep):** 1-2h
- **FASE 2 (Filters):** 1h
- **FASE 3 (Polling):** 2-3h
- **FASE 4 (sessionStorage):** 1h
- **FASE 5 (Testing):** 2-3h
- **FASE 6 (Docs):** 1-2h
- **TOTAL:** 8-12 horas (1 día de desarrollo intenso)

### Post-Refactor
✅ Sistema confiable, mantenible, escalable  
✅ Fácil debuggear (menos moving parts)  
✅ Transacciones ACID garantizadas  
✅ Recuperable sin perder datos  
✅ Performance mejorado (menos state syncing)

---

## APÉNDICE: COMMITS A INCLUIR EN REFACTOR

```bash
# Después de completar refactor:
git commit -m "refactor: polling intelligent + optimistic updates (Single Source of Truth)"
git commit -m "feat: integrate CoordinationFilters with session persistence"
git commit -m "test: E2E coordination drag/drop concurrency"
git commit -m "docs: architecture guide + troubleshooting"
git tag coordination-cleanup-24feb2026
```

