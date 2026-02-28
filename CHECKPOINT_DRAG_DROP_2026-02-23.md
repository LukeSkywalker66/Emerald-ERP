# Checkpoint: Drag & Drop Coordination Grid - 23 Feb 2026

## 🎯 Objetivo Principal
Implementar un sistema robusto de **drag & drop de OTs entre el sidebar (backlog) y el grid de coordinación**, con sincronización perfecta con el backend. Las OTs deben:
- ✅ Poderse arrastrar desde sidebar al grid
- ✅ Poderse mover dentro del grid
- ✅ Poderse extraer desde grid de vuelta al sidebar
- ✅ Persistir en su nueva ubicación indefinidamente
- ✅ Reflejarse siempre en el backend

---

## 📊 Estado Actual (23 Feb 2026 - 10:30 UTC)

### ✅ Completado
1. **Error 500 resuelto**: Root cause fue enum corruption (`status='new'` no en DDL)
   - Migration d7b5e1c2f8a0 (2026-01-05) hizo `LOWER(status)` sin validar valores
   - Fixed: 1 ticket con status='new' → 'open' via Docker
   - Backend stable, `/coordination/grid` retorna 200
   
2. **Grid visual funcional**: 
   - Aparecen OTs en el grid correctamente
   - Drag & drop NO tira errores
   - Validación de colisiones funciona
   - Resizing funciona
   
3. **Sidebar funcional**:
   - Muestra OTs sin asignar (backlog)
   - DraggableWorkOrderCard permite iniciar drag

### ⚠️ Parcialmente Completo
1. **Drag & drop persiste localmente pero no en siguiente recarga**
   - Drag OT → Aparece en grid ✅
   - Desaparece del sidebar ✅  
   - **Pero**: Al hacer `onWorkOrderUpdated()`, el parent (CoordinationGridPage) hace `loadCoordinationGrid()`
   - Backend retorna datos que NO incluyen la OT (por timezone lag/BD async)
   - Grid recibe nuevas OTs sin la que acaba de asignarse
   - OT desaparece del grid ❌

2. **Merge inteligente implementado pero aún falla**
   - Última solución (23 Feb): Lines 75-87 en ImprovedCoordinationGrid.jsx
   - Mantiene "OTs huérfanas" (locales pero no en servidor)
   - Pero: No está claro si la lógica está siendo invocada correctamente

### ❌ No Funciona
- **OTs no persisten**: Desaparecen después del dropdown
- **Extraer OTs**: Botón "Devolver al Backlog" existe pero no probado en contexto de drag
- **Sincronización temporal**: No hay delay/retry logic si backend tarda en actualizar

---

## 🔍 Análisis Técnico Detallado

### Flujo Backend (Correcto)
```
POST /v2/work-orders/{wo_id}/assign
├─ Valida team_id exists
├─ Valida colisión de horarios
├─ Updates WorkOrder:
│  ├─ team_id ← payload.team_id
│  ├─ scheduled_start ← payload.scheduled_start
│  ├─ scheduled_end ← scheduled_start + duracion
│  └─ status ← WorkOrderStatus.scheduled
├─ Agrega TicketTimeline entry
└─ Returns: {id, team_id, scheduled_start, scheduled_end, status}
```

Luego `GET /v2/work-orders/coordination/grid?start_date=YYYY-MM-DD`:
```
Filters allocations by:
  ├─ team_id IS NOT NULL
  ├─ status IN [scheduled, in_progress]
  ├─ scheduled_start IS NOT NULL
  ├─ scheduled_start >= start
  └─ scheduled_start <= end
```

**Problema identificado**: Si el PATCH retorna 200 pero hay lag en la replicación DB, 
el GET posterior no va a encontrar la OT en allocations → el grid la pierde.

### Flujo Frontend (Problemático)

**ImprovedCoordinationGrid.jsx**:
```javascript
// Lines 360-470: handleDrop()
1. User drags OT to grid
2. Validates position + collision
3. API.patch(/assign) con team_id, scheduled_start
4. En setLocalWorkOrders: actualiza OT localmente
5. Llama onWorkOrderUpdated?.() → DISPARADOR DEL PROBLEMA
   └─> Parent (CoordinationGridPage) hace loadCoordinationGrid()
       └─> GET /coordination/grid
           └─> Backend retorna allocations (SIN la OT reciente)
               └─> Grid.props.workOrders = nueva lista sin la OT
                   └─> useEffect en ImprovedCoordinationGrid
                       └─> setLocalWorkOrders(workOrders) 
                           └─> OT desaparece ❌
```

**Solución actual (Lines 75-87)**:
```javascript
useEffect(() => {
  setLocalWorkOrders((prev) => {
    // Crear mapa de OTs nuevas por ID
    const freshIds = new Set(workOrders.map(wo => getWorkOrderId(wo)));
    
    // Mantener OTs previas que NO estén en el nuevo set
    const orphaned = prev.filter(wo => !freshIds.has(getWorkOrderId(wo)));
    
    // Merger: nuevas OTs + OTs locales huérfanas
    return [...workOrders, ...orphaned];
  });
}, [workOrders]);
```

**Problema**: La lógica está correcta pero:
- Depende de que `workOrders` sea el prop que cambia
- CoordinationGridPage pasa `workOrders={gridData?.allocations || []}`
- Si `allocations` no contiene la OT, ella queda "huérfana"
- **Pero**: El merge debería mantenerla... hay un bug de timing o lógica condicional

---

## 📁 Archivos Clave

### Frontend
- **[frontend/src/pages/coordination/CoordinationGridPage.jsx](frontend/src/pages/coordination/CoordinationGridPage.jsx)**
  - Lines 160-175: `loadCoordinationGrid()` - recarga desde backend
  - Lines 290-298: Pasa `workOrders={gridData?.allocations || []}` al grid
  - Lines 179-185: `handleUnassignWorkOrder()` - PATCH `/unassign`

- **[frontend/src/components/coordination/ImprovedCoordinationGrid.jsx](frontend/src/components/coordination/ImprovedCoordinationGrid.jsx)** (669 líneas)
  - Lines 53-73: Constants, state initialization
  - **Lines 75-87: ⚠️ Merge inteligente (PROBABLEMENTE EL BUG ESTÁ ACÁ)**
  - Lines 130-152: Render logic para OTs en grid
  - Lines 360-470: `handleDrop()` - lógica del drag & drop
  - Lines 390-415: API call a `/assign`
  - Lines 420-435: Actualización local del estado

- **[frontend/src/components/coordination/CoordinationSidebar.jsx](frontend/src/components/coordination/CoordinationSidebar.jsx)**
  - Lines 187: Usa `DraggableWorkOrderCard`
  - Props: `workOrders={workOrders}` vienen del parent

### Backend
- **[backend/src/routers/work_orders.py](backend/src/routers/work_orders.py)**
  - Lines 897-971: `@router.patch("/{work_order_id}/assign")` - endpoint de asignación
  - Lines 780-890: `@router.get("/coordination/grid")` - endpoint de consulta grid
  - Lines 820-835: **Filtro allocations** (acá está el problema de la OT no aparecer)
  - Lines 841-875: Backlog filter

- **[backend/src/models/tickets.py](backend/src/models/tickets.py)**
  - Lines 590-750: Modelo `WorkOrder` con `scheduled_start`, `team_id`, `status`
  - Lines 102-112: Enum `WorkOrderStatus` = [open, in_progress, pending, pending_infra, waiting_internal, attention_required, resolved, closed]

---

## 🐛 Bugs Identificados

### Bug #1: OT Desaparece Después de Drop ⚠️ CRÍTICO
**Symptom**: User dropea OT, aparece en grid, pero después de 100ms desaparece
**Root Cause**: Race condition entre:
  - Grid actualiza localmente immediatamente (optimistic)
  - Grid llama `onWorkOrderUpdated()` 
  - Parent recarga TODO desde backend
  - Backend aún no ha propagado la OT a allocations
  - Grid recibe nuevos props sin la OT
  - useEffect reemplaza estado local (aunque hay merge inteligente)

**Intentos Fallidos de Fix**:
1. ❌ Quitar `onWorkOrderUpdated()` completamente → Sidebar nunca se actualiza
2. ❌ Agregar setTimeout delay → Still no garantiza que BD esté actualizada
3. ❌ Merge inteligente complejo con `lastAssignedWoIdRef` → Rompió drag completamente
4. ✅ (Actual) Merge inteligente simple: mantener OTs "huérfanas"

**Estado**: Merge está en código pero no funciona → **Hay un bug de lógica o timing**

### Bug #2: Timezone/Border Conditions
**Symptom**: OT con `scheduled_start` al filo del rango horario podría no aparecer
**Root Cause**: Filtro `scheduled_start >= start && scheduled_start <= end` en backend
  - Si user dropea OT a las 12:00 (fin de la mañana)
  - Backend filtra por `scheduled_start >= 08:00 AND <= 12:00`
  - Probablemente OK pero hay edge cases con UTC conversion

---

## 🔧 Soluciones Alternativas Consideradas

### Opción A: Polling en el Grid
```javascript
// Después de drop, poll cada 500ms hasta que OT aparezca en Backend
// Pros: Garantiza eventual consistency
// Cons: Ineficiente, puede causar parpadeos
```

### Opción B: Backend Devuelve OT en Response
```javascript
// PATCH /assign devuelve NOT SOLO el updated work_order
// SINO TAMBIÉN la lista actualizada de allocations
// Pros: Zero delay, single source of truth
// Cons: Requiere refactoring del endpoint
```

### Opción C: Optimistic Update Permanente (PROPUESTO)
```javascript
// No llamar onWorkOrderUpdated() después de drop
// Solo llamarla cada X segundos o cuando user cambia de fecha
// Pros: Las OTs nunca desaparecen
// Cons: Sidebar podría quedar out-of-sync temporalmente
```

### Opción D: Detección de Cambios Más Inteligente (ACTUAL)
```javascript
// Merge inteligente: mantener OTs que desaparecen del servidor
// Pero VERIFICAR que no sean puras "fantasmas" que se fueron para siempre
// Pros: Robusto, no requiere cambios en backend
// Cons: Complejo, puede tener race conditions sutiles
```

---

## 📋 Checklist para Próxima Sesión

### Paso 1: Diagnosticar el Merge
- [ ] Agregar `console.log` en el useEffect de merge para ver:
  - Qué OTs estaban en `prev`
  - Qué OTs estaban en `workOrders`
  - Qué OTs quedaron como "huérfanas"
  - Si el merge realmente está ejecutándose
- [ ] Abrir DevTools → Console mientras se dropea
- [ ] Documentar exactamente qué logs ves

### Paso 2: Alternativa Simple - No Llamar onWorkOrderUpdated
- [ ] Comentar la línea `onWorkOrderUpdated?.();` en handleDrop()
- [ ] Probar si OT persiste indefinidamente
- [ ] Sidebar se queda sin actualizar → **Problema nuevo**: Necesitas forma alternativa de actualizar sidebar
- [ ] Posible fix: Agregar botón "Refrescar Sidebar" en el grid

### Paso 3: Opción Backend - Devolver Allocations
- [ ] Modificar endpoint `PATCH /assign` para retornar:
  ```python
  {
    "id": wo.id,
    "status": wo.status.value,
    "team_id": wo.team_id,
    "scheduled_start": wo.scheduled_start.isoformat(),
    # NUEVO:
    "updated_allocations": [...lista de TODAS las allocations actualizadas]
  }
  ```
- [ ] Esto permitiría que el grid actualizara sin llamar al parent
- [ ] El parent podría luego sincronizarse en background

### Paso 4: Validar Lógica de Merge
- [ ] Verificar que `getWorkOrderId()` funciona correctamente
- [ ] Probar merge logic en isolation (unit test)
- [ ] Validar que `isSameWorkOrder()` realmente compara OTs correctas

### Paso 5: Implementar Retry Logic
- [ ] Si OT desaparece después de merge, agregar retry automático
- [ ] Backend endpoint puede tener 1-2seg de lag → esperar y reintentar

---

## 🚀 Recomendación para Próxima Sesión

**Comienza por Paso 1**: Agregar logs al merge para entender exactamente qué está pasando.
El código está casi correcto pero hay un bug sutil de timing/lógica que no se ve sin logs reales.

Una vez veas qué está pasando en la consola, tendrás claridad para elegir entre:
- Fijar el merge (probablemente 1 línea de código)
- Ir por la ruta de "no llamar onWorkOrderUpdated()" (requiere UI para refresh manual)
- Refactorizar el backend (opción más robusta pero más trabajo)

---

## 🔗 Commits Relevantes

- **4513e16**: `fix(coordination): robust drop sobre misma OT` - ÚLTIMA VERSION FUNCIONAL
- **749715e**: `feat(coordination): Implementar ImprovedCoordinationGrid con ejes correctos y resize` - Introducción del grid
- **d3a48b1**: Rollback de trabajo_orders.py (12 Feb) - Backend estable

---

## 📞 Notas Finales

- El problema NO está en el backend (asignación funciona)
- El problema NO está en el drag/drop validation (funciona correctamente)
- El problema ESTÁ en la sincronización después del drop
- La raíz es: **Race condition entre optimistic update local y reload desde servidor**
- La solución actual (merge inteligente) es la dirección correcta pero hay un bug sutil

Usa los logs del Paso 1 para breakthrough rápido.
