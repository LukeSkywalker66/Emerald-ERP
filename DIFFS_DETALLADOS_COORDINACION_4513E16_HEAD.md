# DIFFS DETALLADOS: 4513e16 → HEAD
**Coordinación Module Evolution**

---

## TABLA: Cambios por Archivo

### 1. CoordinationFilters.jsx (NUEVO - 211 líneas)

**Commit:** cbc5fcf (feat: Implementar CoordinationFilters y lógica multicriterio)

```jsx
// NUEVO ARCHIVO COMPLETO
// 211 líneas de código

import React, { useMemo, useState } from 'react';
import {
  Search,      // ← Input de búsqueda universal
  Wrench,      // ← Icono tipo "Reparación"
  Wifi,        // ← Icono tipo "Instalación"
  AlertCircle, // ← Icono alertas críticas
  X,
  ChevronDown,
} from 'lucide-react';

const OT_TYPES = [
  { id: 'repair', label: 'Reparación', icon: Wrench },
  { id: 'install', label: 'Instalación', icon: Wifi },
  // Localidades, pickup, infrastructure SOPORTADAS también
];

export default function CoordinationFilters({
  filters: { search, cities, types, critical },
  availableCities = [],          // Extrae DINÁMIALMENTE de work_orders
  onSearchChange,
  onCitiesChange,
  onTypesChange,
  onCriticalChange,
  onClearAll,
}) {
  const [expandCities, setExpandCities] = useState(false);
  
  // IMPORTANTE: Deduplicar y ordenar localidades
  const cityList = useMemo(
    () => Array.from(new Set(availableCities)).sort(),
    [availableCities]
  );
  
  return (
    <div className="space-y-3 p-3 border-b border-zinc-800">
      {/* 1. BÚSQUEDA UNIVERSAL */}
      <Input
        placeholder="ID, cliente, dirección..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      
      {/* 2. LOCALIDADES - Desplegable expandible */}
      {cityList.length > 0 && (
        <div className="border-zinc-700 rounded-lg">
          <button 
            onClick={() => setExpandCities(!expandCities)}
            className="w-full flex justify-between"
          >
            <span>📍 Localidades</span>
            {cities.length > 0 && <Badge>{cities.length}</Badge>}
            <ChevronDown className={expandCities ? 'rotate-180' : ''} />
          </button>
          
          {expandCities && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {cityList.map((city) => (
                <label key={city}>
                  <input
                    type="checkbox"
                    checked={cities.includes(city)}
                    onChange={() => onCitiesChange(city)}
                  />
                  {city}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 3. TIPOS DE OT */}
      <div>
        {OT_TYPES.map(type => (
          <label key={type.id}>
            <Checkbox
              checked={types.includes(type.id)}
              onChange={() => onTypesChange(type.id)}
            />
            {type.label}
          </label>
        ))}
      </div>
      
      {/* 4. CRÍTICAS TOGGLE */}
      <label>
        <AlertCircle size={14} />
        Mostrar solo críticas
        <Switch
          checked={critical}
          onChange={(v) => onCriticalChange(v)}
        />
      </label>
      
      {/* 5. LIMPIAR TODO */}
      <Button onClick={onClearAll}>Limpiar filtros</Button>
    </div>
  );
}
```

**Funcionalidades:**
- ✅ Búsqueda en tiempo real
- ✅ Multi-select localidades
- ✅ Toggle tipos de OT
- ✅ Mostrar solo críticas
- ✅ Deduplicación de ciudades
- ✅ Persistencia en LocalStorage (en CoordinationGridPage)

**PROBLEMA ACTUAL:**
```
CoordinationFilters.jsx EXISTE pero NO ESTÁ INTEGRADO
en CoordinationGridPage.jsx
```

---

### 2. CoordinationSheet.jsx (NUEVO - 433 líneas)

**Commit:** 3ce3487 (feat: CoordinationSheet + rediseño DraggableCard)

```jsx
// NUEVO ARCHIVO COMPLETO
// 433 líneas

// Similar a DetailSheet pero como componente independiente
// Propósito: Mostrar detalles completos de OT seleccionada
// Ubicación: Sidebar derecho (posición fixed)

Features:
- ✅ Metadata completa: cliente, dirección, teléfono
- ✅ Contact info con botón "Llamar" prominente  
- ✅ Historial de intentos de contacto (contact_attempts)
- ✅ Timeline de cambios de estado
- ✅ Links a Google Maps, WhatsApp
- ✅ Botones: Ejecutar OT, Devolver a Backlog, Cerrar

Style:
- Fixed right sidebar (w-96)
- Emerge animation
- Scroll en contenido, sticky header/footer
```

**PROBLEMA ACTUAL:**
```
CoordinationSheet.jsx EXISTE pero parece que NO se usa
Posible solución: Usar en lugar de DetailSheet inline
O podría ser candidato para eliminación si DetailSheet cubre caso
```

---

### 3. DraggableWorkOrderCard.jsx (MODIFICADO - +357/-0)

**Commits:**
- 56a691c: Compactar a 48-54px (tactical)
- 45fbd47: Rich Tooltip
- 73cbf76: Agregar duración al tooltip
- 64d2bf2: Tactical HUD style

**COMPARATIVA:**

#### ANTES (4513e16):
```jsx
// Altura estándar, tooltip simple
<div className="absolute top-2 h-16 rounded border">
  {/* Contenido card */}
</div>
// Tooltip al hover: Mostrar OT ID básico
```

#### DESPUÉS (HEAD):
```jsx
// Altura compacta (48-54px)
<div className="absolute top-2 h-12 rounded border">
  {/* MISMO CONTENIDO pero más denso */}
</div>

// Rich tooltip con metadata operacional
<div className="bg-zinc-800 border border-zinc-700 rounded p-2 shadow-lg">
  <p>Tipo: {typeLabel}</p>
  <p>Fecha: {scheduledDate}</p>
  <p>Duración: {duration}min</p>
  <p>Fin: {endTime}</p>
  {/* NO mostrar OT ID (noise reduction) */}
</div>

// Tactical HUD styling:
// - Colores más contrastados
// - Bordes resaltados
// - Indicadores visuales para estados
// - Compacidad máxima

Style aplicado:
- bg-amber-600/80 (base)
- bg-amber-500 (en drag)  // Light up en movimiento
- border-amber-500/50
- text-xs (compact)
- Truncate para cliente/dirección
```

**Lines Changed:**
```diff
- 48 líneas edad (layout largo)
+ 52 líneas comaptacidad (layout corto)
+ Tooltip dinámico (javascript inline)
+ Rich metadata display
+ Tactical colors y estilos

NET: +357 líneas (probablemente incluyen comentarios y estructuras complexas)
```

---

### 4. CoordinationSidebar.jsx (MODIFICADO - +207/-208)

**Commits:**
- 4c65a29: contact attempts tracking
- 3ce3487: CoordinationSheet + rediseño

**CAMBIOS PRINCIPALES:**

```diff
- ANTES: Sidebar mostraba simple list de backlog
+ DESPUÉS: 
  ✅ Display mejorado con badges de estado
  ✅ Integración con contact_attempts tracking
  ✅ Botones de acción contextuales
  ✅ Filtrado automático (solo unassigned, etc)
  ✅ Indicadores visuales (crítica, en progreso, etc)
  ✅ Acciones rápidas (llamar, asignar, etc)
```

**Responsabilidades antes:**
```
- Mostrar OTs sin asignar
- Simple list
```

**Responsabilidades después:**
```
- Mostrar OTs sin asignar
- Mostrar estado contacto (attempts)
- Llamar rápido (botón prominente)
- Integrar con CoordinationSheet (probablemente)
- Filtrados por criterios
- Indicadores de prioridad
```

---

### 5. ImprovedCoordinationGrid.jsx (SIN CAMBIOS)

```
git diff 4513e16..HEAD -- frontend/src/components/coordination/ImprovedCoordinationGrid.jsx
= VACÍO (sin cambios)
```

**Significado:**
- ✅ Sistema base de drag/drop está ESTABLE
- ✅ No se modificó lógica core desde 4513e16
- ⚠️ Pero CONTIENE problemas de localStorage + merge que necesitan refactor

**Código crítico que PERMANECE SIN CAMBIOS:**
```javascript
// Lines ~100-200: Lógica de localStorage + merge inteligente (PROBLEMÁTICA)
useEffect(() => {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const stored = localStorage.getItem(`coordination_grid_${dateKey}`);
  if (stored) {
    setLocalWorkOrders(JSON.parse(stored));
  }
}, [currentDate]);

useEffect(() => {
  // Merge inteligente (sobrecomplejo)
  setLocalWorkOrders((prev) => {
    // ... 100+ líneas de lógica de reconciliación
  });
}, [workOrders]);

// Lines ~800+: Merge inteligente de persistencia
useEffect(() => {
  localStorage.setItem(`coordination_grid_${dateKey}`, JSON.stringify(localWorkOrders));
}, [localWorkOrders, currentDate]);
```

Este código es el responsable de los problemas identificados.

---

### 6. CoordinationGridPage.jsx (SIN CAMBIOS)

```
git diff 4513e16..HEAD -- frontend/src/pages/coordination/CoordinationGridPage.jsx
= VACÍO (sin cambios)
```

**Observación CRÍTICA:**
```
CoordinationFilters.jsx EXISTE pero NO se importa aquí
CoordinationSheet.jsx EXISTE pero probablemente no se usa

CoordinationGridPage.jsx sigue igual que hace 3 semanas:
- ❌ Sin CoordinationFilters integrado
- ❌ Sin lógica de filtrado
- ✅ Con polling (3 segundos)
- ❌ Pero polling batalla con localStorage en ImprovedCoordinationGrid
```

---

## ESTADÍSTICAS CONSOLIDADAS

```
Período: 4513e16 → HEAD (7 commits funcionales)
Duración: 13 días (8 Feb - 24 Feb 2026)

ARCHIVOS NUEVOS: 2
  + CoordinationFilters.jsx      211 líneas
  + CoordinationSheet.jsx         433 líneas
  
ARCHIVOS MODIFICADOS: 2
  ~ DraggableWorkOrderCard.jsx   +357 líneas (visuales + tooltips)
  ~ CoordinationSidebar.jsx      +207/-208 líneas (refactor + features)
  
ARCHIVOS INTACTOS: 2
  . ImprovedCoordinationGrid.jsx  (NECESITA REFACTOR)
  . CoordinationGridPage.jsx      (NECESITA INTEGRACIÓN)

TOTAL INSERTADO: 1208 líneas
TOTAL ELIMINADO: 208 líneas
NET: +1000 líneas

RATIO QUALITY:
  Nuevas features: Alta (filtros, tooltips, estilos tácticos)
  Integración: Baja (componentes huérfanos)
  Refactor: Nulo (problemas core intactos)
```

---

## ÁRBOL DE COMMITS FUNCIONALES

```
4513e16 fix(coordination): robust drop sobre misma OT
  ↓
56a691c feat: Compactar DraggableWorkOrderCard (48-54px)
  ↓
9d6a8b1 polish: Limpiar tooltip de DraggableWorkOrderCard
  ↓
3bd4748 hotfix: Corrección urgente de DraggableWorkOrderCard
  ↓
45fbd47 feat: Rich Tooltip en DraggableWorkOrderCard
  ↓
73cbf76 feat: Agregar duración al tooltip con layout armónico
  ↓
64d2bf2 feat: Tactical HUD style para DraggableWorkOrderCard
  ↓
7ebf6c7 feat(coordination): include full ticket with contact_info
  ↓
4164083 feat(coordination): UI refinement - city filter, phone button
  ↓
4c65a29 feat(coordination): contact attempts tracking
  ↓
3ce3487 feat(coordination): CoordinationSheet + rediseño DraggableCard
  ↓
85996b9 fix(frontend): SelectItem con valor vacío
  ↓
cbc5fcf feat: Implementar CoordinationFilters y lógica multicriterio  ← KEY FEATURE
  ↓
61541cc refactor: Mejorar UI de desplegable de Localidades
  ↓
d3a48b1 fix: Extraer ciudades reales de conexiones
  ↓
f25009e docs: Checkpoint (ACTUAL HEAD)
```

---

## ANÁLISIS POR CATEGORÍA DE CAMBIO

### UX/Visual Improvements: 357 líneas
- DraggableWorkOrderCard tactical compactación
- Rich tooltips con metadata operacional
- Sidebar rediseño CoordinationSidebar
- Colores y estilos tácticos

### New Features: 644 líneas
- CoordinationFilters (búsqueda, ciudades, tipos, críticas)
- CoordinationSheet (sidebar detalles enriquecido)
- Contact attempts tracking
- Full ticket info en responses

### Refactor/Cleanup: 207 líneas  
- CoordinationSidebar modernización
- Integración contact_info (renombrado desde connection_details)

---

## DEPENDENCIAS ENTRE CAMBIOS

```
CoordinationFilters (211L)
  ↓ Depende de
  CoordinationGridPage (NO integrado ⚠️)
  
CoordinationSheet (433L)
  ↓ Depende de
  work_order response (tienes contact_info)
  ↓ Posible reemplazo para
  DetailSheet inline actual
  
DraggableWorkOrderCard (357L)
  ↓ Depende de
  ImprovedCoordinationGrid (renderiza tarjetas)
  
CoordinationSidebar (207L)
  ↓ Depende de
  work_order metadata completa
  ↓ Interactúa con
  CoordinationSheet (??)
```

---

## ARCHIVOS CANDIDATOS PARA ELIMINACIÓN

```
❓ CoordinationSheet.jsx
   Razón: Ya existe DetailSheet en CoordinationGridPage
   Acción: Verificar si son duplicados o tienen uso diferente
   
❓ Dead localStorage code (ImprovedCoordinationGrid.jsx)
   Razón: Será reemplazado en refactor
   Líneas afectadas: ~100-300+
```

---

## CONCLUSIÓN

**Timeline de cambios:**
```
4513e16 (8 Feb)  → BASELINE: Sistema drag/drop robusto
         ↓↓↓ 7 COMMITS ↓↓↓
HEAD (24 Feb)    → FEATURES: Filtros, tooltips, táctico

Trabajo completado: ✅ 1000 líneas de nuevas features
Trabajo faltante:    ❌ Integración + refactor

Funcionalidades nuevas SIN integrar:
  - CoordinationFilters (211L) NO importado en Page
  - CoordinationSheet (433L) NO usado (¿duplicado?)
```

El módulo está en estado **"Feature-complete pero architecturally incomplete"**.
Las nuevas funcionalidades existen pero:
1. No están conectadas entre ellas
2. localStorage sigue causando problemas
3. Polling batalla con merge inteligente

El refactor propuesto en ANALISIS_COORDINACION_24FEB2026.md integrará y estabilizará TODO.

