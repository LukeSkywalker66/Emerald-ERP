# Estado del Código - Snapshot 23 Feb 2026, 10:40 UTC

## Archivos Críticos Congelados para Referencia

### 1. ImprovedCoordinationGrid.jsx - Sección useEffect (Lines 75-87)

**ESTADO ACTUAL** (Merge inteligente):
```javascript
useEffect(() => {
  // Merge inteligente: mantener OTs locales que acaban de asignarse pero no están en el nuevo set
  setLocalWorkOrders((prev) => {
    // Crear mapa de OTs nuevas por ID para comparación rápida
    const freshIds = new Set(workOrders.map(wo => getWorkOrderId(wo)));
    
    // Mantener OTs previas que NO estén en el nuevo set (acaban de asignarse, BD lag)
    const orphaned = prev.filter(wo => !freshIds.has(getWorkOrderId(wo)));
    
    // Merger: nuevas OTs + OTs locales huérfanas
    return [...workOrders, ...orphaned];
  });
}, [workOrders]);
```

**CAMBIOS POSIBLES**:
- Agregar logs de debug
- Cambiar dependency de `[workOrders]` a `[workOrderIds_string]`
- Agregar deduplicación por ID antes de retornar

---

### 2. ImprovedCoordinationGrid.jsx - handleDrop() sección final (Lines 405-435)

**ESTADO ACTUAL**:
```javascript
const response = await api.patch(
  `/v2/work-orders/${wo.id}/assign`,
  {
    team_id: teamId,
    scheduled_start: newScheduledStart.toISOString(),
    estimated_duration: wo.estimated_duration || 60,
  },
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);

if (!response || response.status < 200 || response.status >= 300) {
  throw new Error(`Error HTTP al asignar OT: ${response?.status}`);
}

const updated = response?.data || {};
setLocalWorkOrders((prev) => prev.map((item) => {
  if (!isSameWorkOrder(item, wo)) return item;
  return {
    ...item,
    team_id: updated.team_id ?? teamId,
    scheduled_start: updated.scheduled_start ?? newScheduledStart.toISOString(),
    scheduled_end: updated.scheduled_end ?? item.scheduled_end,
    estimated_duration: wo.estimated_duration || item.estimated_duration || 60,
  };
}));

console.log('💾 OT actualizada en el backend');
onWorkOrderUpdated?.();
```

**PROBLEMA AQUÍ**: Después del PATCH, llama `onWorkOrderUpdated?.()` que dispara `loadCoordinationGrid()` en el parent.
Este reload es lo que causa que los nuevos workOrders lleguen sin la OT reciente.

**OPCIONES A CONSIDERAR**:
- Comentar `onWorkOrderUpdated?.();` (OTs no desaparecerán pero sidebar no se actualiza)
- Agregar delay: `setTimeout(() => onWorkOrderUpdated?.(), 1000)` (peligroso)
- Agregar flag: `lastAssignedWoIdRef.current = getWorkOrderId(wo)` (para detectar en merge)

---

### 3. CoordinationGridPage.jsx - Props al Grid (Lines 290-298)

**ESTADO ACTUAL**:
```javascript
<ImprovedCoordinationGrid
  teams={gridData?.teams || []}
  workOrders={gridData?.allocations || []}
  currentDate={currentDate}
  onWorkOrderUpdated={loadCoordinationGrid}
  onEventClick={handleEventClick}
  activeTimeBlock={activeTimeBlock}
/>
```

**NOTA CRÍTICA**: `workOrders={gridData?.allocations || []}`
- Cada vez que `loadCoordinationGrid()` se ejecuta, esto es una nueva referencia
- Esto dispara el useEffect del grid (si dependency es `[workOrders]`)
- Probablemente desencadena múltiples renders

---

### 4. CoordinationGridPage.jsx - loadCoordinationGrid() (Lines 160-175)

**ESTADO ACTUAL** - Obtener datos completos del servidor:
```javascript
async function loadCoordinationGrid() {
  setIsLoading(true);
  setError(null);
  try {
    const dateParam = format(currentDate, 'yyyy-MM-dd');
    const response = await api.get('/v2/work-orders/coordination/grid', {
      params: {
        start_date: dateParam,
        end_date: dateParam,
      },
    });
    setGridData(response.data);
  } catch (err) {
    console.error('Error cargando grid:', err);
    const errorMsg = err.response?.data?.detail || err.message || 'Error al cargar la coordinación';
    setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  } finally {
    setIsLoading(false);
  }
}
```

**PROBLEMA**: No hay retry logic. Si la OT no está aún en el servidor, no lo intenta de nuevo.

---

### 5. Backend: work_orders.py - Filtro de Allocations (Lines 820-835)

**ESTADO ACTUAL**:
```python
# Allocations (scheduled/in_progress en rango)
allocations = db.query(WorkOrder)\
    .filter(
        WorkOrder.team_id.isnot(None),
        WorkOrder.status.in_([WorkOrderStatus.scheduled, WorkOrderStatus.in_progress]),
        WorkOrder.scheduled_start.isnot(None),
        WorkOrder.scheduled_start >= start,
        WorkOrder.scheduled_start <= end,
    )\
    .options(
        selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
        selectinload(WorkOrder.team),
        selectinload(WorkOrder.technician),
    ).all()
```

**VERIFICAR**: 
- ¿Tiene la OT `team_id` asignado? → SÍ (PATCH lo pone)
- ¿Tiene status `scheduled`? → SÍ (PATCH lo pone: `wo.status = WorkOrderStatus.scheduled`)
- ¿Tiene `scheduled_start`? → SÍ (PATCH lo pone)
- ¿Está en rango? → PROBABLEMENTE (usuario lo dropea hoy)

Si la OT cumple todos estos, debería aparecer. Si no aparece → **problema de replicación DB o timezone**.

---

## 📋 Checklist de Verificación para Próxima Sesión

### En el Frontend Console (F12 → Console)
- [ ] ¿Ves el log `💾 OT actualizada en el backend`?
- [ ] ¿Se ejecuta el merge useEffect? (agregar console.log al inicio)
- [ ] ¿Qué IDs estaban en `prev`?
- [ ] ¿Qué IDs vinieron en `workOrders`?
- [ ] ¿Qué quedó como `orphaned`?
- [ ] ¿El resultado de merge contiene la OT?

### En el Backend Logs (docker compose logs backend)
- [ ] ¿PATCH `/assign` retorna 200?
- [ ] ¿La OT tiene `team_id` después del PATCH?
- [ ] ¿La OT tiene `status='scheduled'` después del PATCH?
- [ ] ¿GET `/coordination/grid` la encuentra en allocations?
  - Agregar debug log en backend: `print(f"OT #{wo.id} in allocations: {wow.team_id}")` 

---

## 🔄 Git Reference Points

**Commits importantes**:
- `4513e16` - Grid with merge (ACTUAL)
- `749715e` - Grid creado por primera vez
- `d3a48b1` - Rollback de work_orders.py a versión estable (12 Feb)

**Para revertir si es necesario**:
```bash
git show 4513e16:frontend/src/components/coordination/ImprovedCoordinationGrid.jsx > backup.jsx
git checkout 4513e16 -- frontend/src/components/coordination/ImprovedCoordinationGrid.jsx
```

---

## 🚨 Critical Sections to NOT Modify

1. **handleDrop() validation logic** (Lines 345-385)
   - Colisión detection: Funciona perfectamente
   - Horario validation: Funciona perfectamente
   - Solo modificar si está claramente roto

2. **getWorkOrderPosition()** (Lines 190-230)
   - Cálculo de posición visual
   - Muy sensible a cambios

3. **CSS/Styling**
   - NUNCA tocar sin confirmación del user
   - Regla de oro #1

4. **Database Filter en Backend**
   - Modificar SOLO si está claramente incorrecto
   - Primero agregar logs, después modificar

---

## 📊 Tamaño de Archivos Críticos

- ImprovedCoordinationGrid.jsx: 679 líneas (restringir cambios a 75-87, 405-435)
- CoordinationGridPage.jsx: 336 líneas (restringir a 160-175, 290-298)
- work_orders.py: 1188 líneas (restringir a 820-835)

---

Documento generado: 23 Feb 2026, 10:40 UTC
Generador: GitHub Copilot
Objetivo: Facilitar debugging en próxima sesión sin perder contexto
