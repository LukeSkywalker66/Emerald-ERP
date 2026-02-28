# Análisis de Estado: Drag & Drop Grid - Código Actual

## Estado del Código (23 Feb 2026, 10:35 UTC)

### ✅ Commits Aplicados Actualmente
- **4513e16** del grid (ImprovedCoordinationGrid.jsx)
- Merge inteligente en Lines 75-87
- Backend estable (error 500 fijo)

---

## 🔴 Problemas de Lógica Detectados

### En ImprovedCoordinationGrid.jsx Lines 75-87

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

### ❌ Posibles Bugs:

**Bug A: Dependencies Array**
```javascript
}, [workOrders]); // ← Esto dispara CADA VEZ que workOrders cambia
```
Problema: Si workOrders viene de `gridData?.allocations`, cambia cada vez que `loadCoordinationGrid()` 
se ejecuta (que es cada vez que se dropea algo). Esto podría causar race conditions.

**Bug B: Double-Logic**
La lógica de merge asume que una OT "desaparece" del servidor significa que acaba de asignarse.
Pero ¿y si fue eliminada por otra razón? La OT podría quedar "zombie" para siempre en la lista local.

**Bug C: No hay deduplicación**
```javascript
return [...workOrders, ...orphaned];
// Si una OT está en AMBOS, vas a tener duplicados
```

Solución: Verificar primero que no haya duplicados por ID.

---

## 🔧 Diagnóstico Recomendado

### Logs a Agregar (en ImprovedCoordinationGrid.jsx)

```javascript
useEffect(() => {
  setLocalWorkOrders((prev) => {
    console.log('=== MERGE DEBUG ===');
    console.log('prev.length:', prev.length, 'prev IDs:', prev.map(wo => getWorkOrderId(wo)));
    console.log('workOrders.length:', workOrders.length, 'fresh IDs:', workOrders.map(wo => getWorkOrderId(wo)));
    
    const freshIds = new Set(workOrders.map(wo => getWorkOrderId(wo)));
    const orphaned = prev.filter(wo => !freshIds.has(getWorkOrderId(wo)));
    
    console.log('orphaned.length:', orphaned.length, 'orphaned IDs:', orphaned.map(wo => getWorkOrderId(wo)));
    
    const merged = [...workOrders, ...orphaned];
    console.log('merged.length:', merged.length, 'merged IDs:', merged.map(wo => getWorkOrderId(wo)));
    
    return merged;
  });
}, [workOrders]);
```

También en handleDrop() después de PATCH exitoso:

```javascript
console.log('✅ PATCH exitoso, OT:', wo.id, 'asignada a team:', teamId);
setLocalWorkOrders((prev) => {
  console.log('Local WOs ANTES:', prev.map(wo => getWorkOrderId(wo)));
  const updated = prev.map((item) => { ... });
  console.log('Local WOs DESPUÉS:', updated.map(wo => getWorkOrderId(wo)));
  return updated;
});
```

---

## 📊 Flujo de Datos Esperado vs Real

### Flujo Esperado (Ideal)
```
User dropea OT#5
    ↓
handleDrop() validado ✓
    ↓
PATCH /assign → Backend: OT#5.team_id=3 ✓
    ↓
setLocalWorkOrders: OT#5 → team_id=3, scheduled_start=... ✓
    ↓
onWorkOrderUpdated() → Parent llama loadCoordinationGrid() ✓
    ↓
GET /coordination/grid → Backend retorna allocations
    ├─ Si incluye OT#5 → merge ve que ya está → OK ✓
    └─ Si NO incluye OT#5 → merge la mantiene como huérfana → OK ✓
    ↓
Grid retorna allocations visibles:
    ├─ OT#5 (con team_id=3) en grid ✓
    └─ Sidebar sin OT#5 ✓
```

### Flujo Real (Lo que probablemente pasa)
```
User dropea OT#5
    ↓
handleDrop() validado ✓
    ↓
PATCH /assign → Backend: OT#5.team_id=3 ✓
    ↓
setLocalWorkOrders: OT#5 → team_id=3, scheduled_start=... ✓
    ↓
onWorkOrderUpdated() → Parent llama loadCoordinationGrid() ✓
    ↓
GET /coordination/grid → Backend retorna allocations
    └─ NO incluye OT#5 (aún no propagated o filter issue) ✗
    ↓
setLocalWorkOrders((prev) => {
    freshIds = {1, 2, 3, 4} // OT#5 NO AQUÍ
    orphaned = prev.filter(wo => !freshIds.has(getWorkOrderId(wo)))
    // orphaned debería = [OT#5]
    return [...workOrders, ...orphaned]
    // return [OT#1, OT#2, OT#3, OT#4, OT#5] ← Correcto!
    // PERO: ¿Realmente ejecuta esto?
})
    ↓
allocations = useMemo(() => {
    return localWorkOrders.filter((wo) => {
        if (!wo.scheduled_start) return false; // ← OT#5 tiene scheduled_start
        const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
        return woDay === dayStr; // ← OT#5 debe pasar esto también
    });
})
    ↓
Grid should show OT#5 ← PERO NO LO HACE ✗
```

---

## 🎯 Puntos a Verificar en Próxima Sesión

1. **¿Se ejecuta el useEffect del merge?**
   - Agregar `console.log('MERGE TRIGGERED')` al inicio del useEffect
   - Si no ves este log, significa que `workOrders` NO cambia o deps está mal

2. **¿Se ejecuta correctamente la lógica del merge?**
   - Ver qué IDs estaban en `prev`
   - Ver qué IDs vinieron en `workOrders`
   - Ver qué quedó como `orphaned`

3. **¿El estado local actualizado realmente tiene la OT?**
   - Después de que merge retorna, agregar log:
   - `console.log('localWorkOrders DESPUÉS de merge:', localWorkOrders.map(wo => wo.id))`

4. **¿El allocations.useMemo está filtrando correctamente?**
   - Probablemente SÍ (esto siempre ha funcionado)
   - Pero verificar que after merge, la OT pase los filtros

5. **¿El render corre correctamente?**
   - Verificar que allocations tenga la OT antes de pasar a getTeamWorkOrders()
   - Agregar log en getTeamWorkOrders() para ver qué OTs recibe

---

## 💡 Soluciones Rápidas a Intentar

### Quick Win #1: Remover el Dependencies Array
Si el problema es que `workOrders` es una referencia nueva cada vez, quizá necesites:

```javascript
useEffect(() => {
  // Comparar por valor, no por referencia
  const workOrderIds = workOrders.map(wo => getWorkOrderId(wo)).join(',');
  setLocalWorkOrders((prev) => {
    // ... merge logic
  });
}, [workOrderIds]); // ← Cambiar dependency a string de IDs
```

### Quick Win #2: Deduplicar en el Merge
```javascript
const merged = [...workOrders, ...orphaned];
// Remover duplicados
const seenIds = new Set();
const deduplicated = merged.filter(wo => {
  const woId = getWorkOrderId(wo);
  if (seenIds.has(woId)) return false;
  seenIds.add(woId);
  return true;
});
return deduplicated;
```

### Quick Win #3: Verificar que OT pase el filter de día
```javascript
const dayStr = format(currentDate, 'yyyy-MM-dd');
const orphaned = prev.filter(wo => {
  // Verificar que OT esté en el día correcto ANTES de hacerla huérfana
  if (!wo.scheduled_start) return false;
  const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
  if (woDay !== dayStr) return false; // NO devolver si es otro día
  return !freshIds.has(getWorkOrderId(wo));
});
```

---

## 📝 Próximos Pasos Ordenados

1. **Sesión siguiente**: Agregar todos los logs descritos, probar drag nuevamente
2. **Analizar console output** y determinar dónde se corta la lógica
3. **Fix basado en logs**: Probablemente una de las "Quick Wins" va a resolver
4. **Testing completo**: Probar todas las edge cases listadas en el checkpoint anterior
5. **Documentación**: Actualizar este archivo con los resultados

---

## 🔗 Archivos a Revisar Simultáneamente

- `frontend/src/components/coordination/ImprovedCoordinationGrid.jsx` - Lines 75-87 (merge)
- `frontend/src/components/coordination/ImprovedCoordinationGrid.jsx` - Lines 130-152 (allocations filter)
- `frontend/src/components/coordination/ImprovedCoordinationGrid.jsx` - Lines 360-435 (handleDrop)
- `frontend/src/pages/coordination/CoordinationGridPage.jsx` - Lines 160-175 (loadCoordinationGrid)
- `backend/src/routers/work_orders.py` - Lines 820-835 (allocations filter en backend)

---

## 🛡️ Reglas de Oro para Modificar

1. **No tocar estilos CSS** → Work solo funciona si se ve bien
2. **No eliminar validación de colisiones** → Crítico para data integrity
3. **No cambiar response del PATCH** → Frontend y Backend deben ser consistentes
4. **No agregar setTimeout** → Causa parpadeos y confunde el merge logic
5. **No quitar logs después de fijar** → Útil para debugging futuro

---

Estado documen tado por: GitHub Copilot
Fecha: 23 Febrero 2026, 10:35 UTC
Sesiones trabajadas: 4
Commits revisados: 10+
Branch: develop (Emerald-ERP)
