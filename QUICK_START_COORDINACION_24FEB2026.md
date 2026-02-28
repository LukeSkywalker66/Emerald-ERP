# QUICK START: Refactorización del Módulo de Coordinación
**Fecha:** 24 de febrero de 2026  
**Duración estimada:** 8-12 horas de desarrollo  
**Dificultad:** ⚠️ ALTA - Requiere cambios arquitectónicos  

---

## 📋 RESUMEN EJECUTIVO

Tu análisis identificó que el módulo de Coordinación tiene:

### ✅ LO BUENO
- Sistema de drag & drop robusto
- Validación de colisiones funcional
- Resize de OTs preciso
- CoordinationFilters CREADO (pero no integrado)
- Componentes visuales modernos (tactical HUD)

### ❌ LO MALO
- **localStorage + polling = race conditions**
- **Merge inteligente sobrecomplejo (120 líneas)**
- **CoordinationFilters existe pero NO FUNCIONA**
- **CoordinationSheet existe pero NO SE USA**
- **Estado se pierde al navegar afuera**

### 🎯 LA SOLUCIÓN
1. **BD como SINGLE SOURCE OF TRUTH** (no localStorage)
2. **Polling inteligente** (5s, pausado si página oculta)
3. **Optimistic updates** (UI respuesta inmediata → revert si falla)
4. **Integrar CoordinationFilters** (ya existe, solo conectar)
5. **sessionStorage solo para preferencias UI** (no datos)

---

## 🚀 CÓMO EMPEZAR

### OPCIÓN A: Refactorización Completa (Recomendado)
**Tiempo:** 8-12 horas | **Riesgo:** Medio | **Beneficio:** Máximo

Sigue el plan en **ARQUITECTURA_PROPUESTA_DIAGRAMAS.md**:
```
FASE 1 (1-2h) → FASE 2 (1h) → FASE 3 (2-3h) 
→ FASE 4 (1h) → FASE 5 (2-3h) → FASE 6 (1-2h)
```

### OPCIÓN B: Integración Rápida de Filtros (Patch)
**Tiempo:** 1 hora | **Riesgo:** Bajo | **Beneficio:** Medio

Si no quieres tocar localStorage aun:
```bash
# Solo integra CoordinationFilters
# Mantén polling/localStorage como está
# Risgo: Filtros funcionan pero estado sigue desincronizado
```

### OPCIÓN C: Hotfix + Plan
**Tiempo:** 30 min ahora + 8h después | **Riesgo:** Bajo | **Beneficio:** Alto

```bash
# Limpia localStorage corruption
# Implementa lógica de polling fix
# Planifica refactor para próxima sesión
```

---

## 📊 MIS RECOMENDACIONES

### 💰 SI TIENES 4-5 HORAS HOY
→ **Haz OPCIÓN C (Hotfix + Documentación)**
- Limpia localStorage viejo
- Ajusta polling interval
- Documenta plan detallado
- Deja todo listo para mañana

### 💼 SI TIENES 8-12 HORAS HOY
→ **Haz OPCIÓN A (Full Refactor)**
- Hazlo EN UNA SESIÓN
- No dividas entre días (causa merge conflicts)
- Testing E2E después
- Merge a develop al final

### ⚡ SI TIENES 1-2 HORAS
→ **Haz OPCIÓN B (Integra Filtros)**
- No toca arquitectura base
- Agrega funcionalidad inmediatamente
- Low risk
- Foundation para refactor futuro

---

## 📁 ARCHIVOS DE REFERENCIA (YA CREADOS)

```
/opt/emerald-erp/
  ├─ ANALISIS_COORDINACION_24FEB2026.md          ← Análisis COMPLETO
  │  (11,000 palabras)
  │  14 secciones detalladas
  │  Plan paso-a-paso FASE 1-6
  │  Riesgos y mitigaciones
  │
  ├─ DIFFS_DETALLADOS_COORDINACION_4513E16_HEAD.md ← Diffs por commit
  │  Qué cambió desde 4513e16
  │  Estadísticas línea por línea
  │  Árbol de commits
  │
  └─ ARQUITECTURA_PROPUESTA_DIAGRAMAS.md         ← Diagramas + pseudocódigo
     Flujo actual vs propuesto
     Hooks custom (código completo)
     Checklist testing E2E
     Deployment strategy
```

### Cómo leerlos:
```
1. PRIMERO: Lee la sección "1. DIFF DETALLADO" en el ANALISIS
   (entiende qué cambió)
   
2. SEGUNDO: Lee "3. ARQUITECTURA ACTUAL" en el ANALISIS
   (entiende los problemas)
   
3. TERCERO: Lee "5. PROPUESTA DE ARQUITECTURA" en el ANALISIS
   (entiende la solución)
   
4. CUARTO: Lee "1. FLUJO DE DATOS" en ARQUITECTURA_PROPUESTA
   (visualiza cómo funciona)
   
5. FINALMENTE: Sigue FASE 1-6 en ANALISIS
   (implementación paso-a-paso)
```

---

## ⚔️ QUICK DECISION TREE

```
┌─ ¿Tienes >= 8 horas continuos?
│  └─ SÍ  → OPCIÓN A (Full refactor)
│     NO  ─┐
│
├─ ¿Tienes >= 4 horas?
│  └─ SÍ  → OPCIÓN C (Hotfix + plan)
│     NO  ─┐
│
└─ ¿Tienes >= 1 hora?
   └─ SÍ  → OPCIÓN B (Integra filtros)
      NO  → Leer tickets en otra tarea
```

---

## 🔴 PUNTOS CRÍTICOS A RECORDAR

### ❌ NO HAGAS:
- `git rebase` durante el refactor (causa conflictos)
- Cambios en 5 archivos a la vez (test incrementalmente)
- `localStorage.setItem()` para datos BD (solo UI prefs)
- Remover CoordinationFilters/CoordinationSheet (son nuevos features)
- Elminar código viejo sin backup (crear branch primero)

### ✅ SIEMPRE:
- Crea rama de feature: `git checkout -b refactor/coordination-v2`
- Backup antes: `git branch backup-24feb2026`
- Push frecuentemente: `git push origin refactor/...`
- Testea incrementalmente (después de cada fase)
- Mantén comentarios técnicos en el código

### 📍 CHECKPOINTS:
- FASE 1: Nuevo hook usable → Commitea
- FASE 2: CoordinationFilters integrado → Testea
- FASE 3: localStorage removido, polling funciona → CRÍTICO
- FASE 4: sessionStorage funciona, estado persiste → Testea
- FASE 5: Tests E2E pasan → Importante
- FASE 6: Code review pasada → Ready

---

## 🧪 TESTING RÁPIDO POST-REFACTOR

### Test #1: Drag & Drop (5 min)
```
1. Abre /coordination
2. Arrastra OT de backlog a Team A, 08:00
3. ¿Aparece INMEDIATAMENTE sin esperar? ✅ Optimistic working
4. ¿Aparece error si colisionan? ✅ Validation working
5. Recarga página → ¿OT sigue asignada? ✅ Backend persisted
```

### Test #2: Filtros (3 min)
```
1. Abre /coordination
2. Aplica filtro "CABA"
3. ¿Se filtran solo OTs en CABA? ✅ Search working
4. Recarga página → ¿Filtros restaurados? ✅ sessionStorage working
5. Limpia filtros → ¿Vuelve a mostrar todo? ✅ Clear working
```

### Test #3: Navegación (5 min)
```
1. Aplica filtros en /coordination
2. Selecciona OT, abre detail sheet
3. Clica "Ejecutar OT" → va a /work-orders/123
4. Vuelve atrás → /coordination recarga
5. ¿Filtros restaurados? ✅ State persistence working
6. ¿OTs correctas? ✅ Polling actual working
```

### Test #4: Concurrencia (10 min)
```
1. Abre DOS navegadores (mismo usuario, misma fecha/equipo)
2. En browser A: Arrastra WO#100 a 08:00
3. En browser B: Arrastra WO#200 a 08:00 (misma posición)
4. Si uno falla (409) → ✅ Conflict detection working
5. Polling sincroniza verdad → ✅ Recovery working
```

---

## 🎬 QUICK START: OPCIÓN B (1 hora, bajo riesgo)

Si tienes poco tiempo y quieres integrar filtros YA:

### Paso 1: Preparar (5 min)
```bash
cd /opt/emerald-erp
git checkout -b feat/coordination-filters-integration
```

### Paso 2: Modificar CoordinationGridPage (40 min)
```javascript
// frontend/src/pages/coordination/CoordinationGridPage.jsx

import CoordinationFilters from '@/components/coordination/CoordinationFilters';
import { useCoordinationFilters, useFilteredWorkOrders } 
  from '@/coordination/hooks';

export default function CoordinationGridPage() {
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const { filters, setSearch, toggleCity, toggleType, toggleCritical, clearAll } 
    = useCoordinationFilters(dateKey);
  
  // ... existing code ...
  
  return (
    <>
      <Header ... />
      
      {/* NUEVO: Agregar CoordinationFilters */}
      <CoordinationFilters
        filters={filters}
        availableCities={gridData?.availableCities || []}
        onSearchChange={setSearch}
        onCitiesChange={toggleCity}
        onTypesChange={toggleType}
        onCriticalChange={toggleCritical}
        onClearAll={clearAll}
      />
      
      {/* MODIFICAR: Pasar filters a grid */}
      <ImprovedCoordinationGrid
        teams={gridData?.teams || []}
        workOrders={gridData?.allocations || []}
        filters={filters}  {/* NUEVO */}
        // ... resto igual ...
      />
    </>
  );
}
```

### Paso 3: Modificar ImprovedCoordinationGrid (10 min)
```javascript
// frontend/src/components/coordination/ImprovedCoordinationGrid.jsx

export default function ImprovedCoordinationGrid({
  teams = [],
  workOrders = [],
  filters = {},  // NUEVO
  // ... resto igual ...
}) {
  // Aplicar filters al workflow actual
  const filteredWorkOrders = useMemo(() => {
    if (!filters.search && filters.cities.length === 0 && 
        filters.types.length === 0 && !filters.critical) {
      return workOrders;
    }
    
    return workOrders.filter(wo => {
      // Search
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!String(wo.id).includes(search) &&
            !wo.client_name?.toLowerCase().includes(search) &&
            !wo.address?.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Cities
      if (filters.cities.length > 0) {
        if (!filters.cities.some(city => wo.address?.includes(city))) {
          return false;
        }
      }
      
      // Types
      if (filters.types.length > 0) {
        if (!filters.types.includes(wo.ot_type)) {
          return false;
        }
      }
      
      // Critical
      if (filters.critical && !wo.is_critical) {
        return false;
      }
      
      return true;
    });
  }, [workOrders, filters]);
  
  // Usar filteredWorkOrders en lugar de localWorkOrders/workOrders
  // El resto del código sigue igual
  const allocations = useMemo(() => {
    const dayStr = format(currentDate, 'yyyy-MM-dd');
    return filteredWorkOrders.filter(wo => {
      // ... lógica actual ...
    });
  }, [filteredWorkOrders, currentDate]);
  
  // ... resto sin cambios ...
}
```

### Paso 4: Testear (5 min)
```bash
# 1. Reload página
# 2. Aplica filtros → ¿funcionan?
# 3. Recarga → ¿persisten en sesión?
# 4. Limpia → ¿vuelven al default?
```

### Paso 5: Commit
```bash
git add frontend/src/pages/coordination/CoordinationGridPage.jsx
git add frontend/src/components/coordination/ImprovedCoordinationGrid.jsx
git commit -m "feat: integrate CoordinationFilters with grid"
git push origin feat/coordination-filters-integration
```

**⚠️ Nota:** Esto NO arregla los problemas de localStorage. Pero agrega funcionalidad nueva sin riesgo. Puedes hacer refactor completo después.

---

## 🎬 QUICK START: OPCIÓN A (8-12 horas, refactor completo)

Para el refactor completo, sigue paso-a-paso:

### FASE 1: Setup custom hooks (1-2 horas)
```bash
# 1. Crear archivos
touch frontend/src/components/coordination/hooks/useCoordinationSync.js
touch frontend/src/components/coordination/hooks/useOptimisticUpdates.js
touch frontend/src/components/coordination/hooks/useCoordinationFilters.js

# 2. Copiar código pseudocódigo de ARQUITECTURA_PROPUESTA_DIAGRAMAS.md
#    (Secciones 3.1, 3.2, 3.3)

# 3. Adaptar a tu setup (imports, paths, etc)

# 4. Commit
git commit -m "setup: create custom hooks for coordination"
```

### FASE 2: Integrar CoordinationFilters (1 hora)
```bash
# Sigue pasos de OPCIÓN B arriba
git commit -m "feat: integrate CoordinationFilters"
```

### FASE 3: **CRÍTICO** Reemplazar localStorage (2-3 horas)
```javascript
// ImprovedCoordinationGrid.jsx

// REMOVER todas estas líneas:
// const [localWorkOrders, setLocalWorkOrders] = useState(workOrders);
// const lastAssignedRef = useRef(new Map());
// const [pendingAssignments, setPendingAssignments] = useState([]);
// useEffect() localStorage restore
// useEffect() merge inteligente (120 líneas!)
// useEffect() localStorage persist

// AGREGAR:
const optimisticUpdatesRef = useRef(new Map());

// SIMPLIFICAR allocations (sin merge):
const allocations = useMemo(() => {
  const dayStr = format(currentDate, 'yyyy-MM-dd');
  const allWOs = [...workOrders];
  
  // Mix with optimistic
  for (const [woId, wo] of optimisticUpdatesRef.current) {
    const idx = allWOs.findIndex(w => w.id === woId);
    if (idx >= 0) {
      allWOs[idx] = wo;
    } else {
      allWOs.push(wo);
    }
  }
  
  return allWOs.filter(wo => {
    if (!wo.scheduled_start) return false;
    const woDay = format(new Date(wo.scheduled_start), 'yyyy-MM-dd');
    return woDay === dayStr;
  });
}, [workOrders, optimisticUpdatesRef.current]);
```

**Este es el cambio más delicado. Testing exhaustivo después.**

### FASE 4: sessionStorage para UI (1 hora)
```javascript
// Guardar filtros, turno, selección
useEffect(() => {
  const key = `coordination_${format(currentDate, 'yyyy-MM-dd')}`;
  const state = { filters, activeTimeBlock, selectedWoId };
  sessionStorage.setItem(key, JSON.stringify(state));
}, [filters, activeTimeBlock, selectedWoId, currentDate]);

// Restaurar
useEffect(() => {
  const key = `coordination_${format(currentDate, 'yyyy-MM-dd')}`;
  const saved = sessionStorage.getItem(key);
  if (saved) {
    const { filters: f, activeTimeBlock: t, selectedWoId: s } = JSON.parse(saved);
    setFilters(f);
    setActiveTimeBlock(t);
    setSelectedWorkOrderId(s);
  }
}, []);
```

### FASE 5: Testing E2E (2-3 horas)
Sigue checklist en ARQUITECTURA_PROPUESTA_DIAGRAMAS.md sección 7.

### FASE 6: Documentación (1-2 horas)
- Actualizar README
- Documentar hooks
- Agregar diagramas

### Commit final:
```bash
git commit -m "refactor: single source of truth architecture"
git tag coordination-cleanup-24feb2026
git push origin refactor/coordination-v2 --tags
```

---

## 🤔 PREGUNTAS FRECUENTES

### P: ¿Perderé datos durante el refactor?
**R:** No. Backend (BD) es FUENTE DE VERDAD. Frontend es cache. Si algo falla, reload = datos nuevos del backend.

### P: ¿Cuánto tarda en producción?
**R:** Deploy sin downtime. Cambios de frontend. Backend API sin cambios (compatible).

### P: ¿Puedo hacer refactor + seguir atendiendo bugs?
**R:** NO. Requiere sesión dedicada sin interrupciones. Usa branch feature para aislar.

### P: ¿Qué pasa si polling trae datos mientras estoy en otra página?
**R:** Polling se pausa (Visibility API). Cuando vuelves, sigue desde donde estaba. Sin problema.

### P: ¿CoordinationSheet se borra?
**R:** NO. CoordinationSheet se PRESERVA pero posible duplicado con DetailSheet. Investigar si usar uno o eliminar.

### P: ¿localStorage tiene datos útiles que pueda perder?
**R:** Solo snapshots OLD de OTs. Nada crítico. Limpia antes del refactor:
```javascript
for (let key of Object.keys(localStorage)) {
  if (key.startsWith('coordination_grid_')) {
    localStorage.removeItem(key);
  }
}
```

### P: ¿Qué hago si me quedo atrapado?
**R:** Usa branch backup:
```bash
git reset --hard HEAD~10  # O commits que necesites
git checkout backup-24feb2026
```

---

## 📞 SOPORTE

Si necesitas ayuda durante el refactor:

1. **Verifica logs:** `console.log()` en hooks
2. **Inspecciona state:** React DevTools
3. **Network tab:** Verifica llamadas API
4. **Test incrementalmente:** No hagas todas las fases a la vez
5. **Rollback:** Si todo rompe → usa backup branch

---

## ✅ CHECKLIST FINAL

Antes de dar por completado el refactor:

- [ ] localStorage completamente removido (búsqueda: "localStorage")
- [ ] Merge inteligente eliminado (búsqueda: "lastAssignedRef")
- [ ] useCoordinationSync hook funciona
- [ ] useOptimisticUpdates funciona
- [ ] CoordinationFilters integrado y testado
- [ ] Drag & drop optimistic working
- [ ] Resize optimistic working
- [ ] Polling automático funcionando
- [ ] Polling pausado cuando tab oculto
- [ ] sessionStorage guardando filtros
- [ ] sessionStorage guardando turno
- [ ] Estado persiste tras nav exterior
- [ ] Colisiones detectadas correctamente
- [ ] Errores muestra toast y revierte
- [ ] 409 Conflicts handled
- [ ] Tests E2E pasando
- [ ] No memory leaks
- [ ] Performance sin degradación
- [ ] Code review pasada
- [ ] Documentación actualizada
- [ ] Backup branch created
- [ ] Ready para merge a develop

---

## 🎉 ÉXITO!

Una vez completo, la coordinación tendrá:

✅ **Architecture:** Single Source of Truth  
✅ **Responsiveness:** Optimistic Updates  
✅ **Reliability:** State always recoverable  
✅ **UX:** Filtros funcionales, estado persistente  
✅ **Maintainability:** Código limpio, hooks reutilizables  
✅ **Scalability:** Listo para más features (drag groups, etc)

---

**Documentos de referencia:**
- [ANALISIS_COORDINACION_24FEB2026.md](file:///opt/emerald-erp/ANALISIS_COORDINACION_24FEB2026.md) - Análisis exhaustivo
- [DIFFS_DETALLADOS_COORDINACION_4513E16_HEAD.md](file:///opt/emerald-erp/DIFFS_DETALLADOS_COORDINACION_4513E16_HEAD.md) - Diffs específicos
- [ARQUITECTURA_PROPUESTA_DIAGRAMAS.md](file:///opt/emerald-erp/ARQUITECTURA_PROPUESTA_DIAGRAMAS.md) - Diagramas + código

**¡Buena suerte! 🚀**
