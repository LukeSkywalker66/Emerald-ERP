# Testing Plan - FASE 5: Refactor de Coordinación NASA-Grade

**Fecha**: 24 Feb 2026  
**Status**: En Ejecución - FASE 5/6  
**Objetivo**: Validar que el refactor completo (sin localStorage, con polling, filtros integrados) funciona correctamente

---

## 1. Cambios Principales Realizados

### ✅ COMPLETADO
- **FASE 1**: Crear `useCoordinationSync` hook (polling 5s, Visibility API)
- **FASE 1**: Crear `useOptimisticUpdates` hook (optimistic UI)
- **FASE 2**: Integrar `CoordinationFilters` en `CoordinationGridPage`
- **FASE 2**: Agregar función `applyCoordinationFilters()` a `ImprovedCoordinationGrid`
- **FASE 3**: Remover localStorage de `ImprovedCoordinationGrid`
- **FASE 3**: Remover merge inteligente complejo (120+ líneas)
- **FASE 3**: Remover `lastAssignedRef`, `pendingAssignments`, `markLocalAssignment`
- **FASE 3**: Remover almacenamiento de snapshots
- **FASE 4**: Agregar sessionStorage para filtros en `CoordinationGridPage`
- **FASE 4**: Agregar sessionStorage para activeTimeBlock
- **FASE 4**: Persisten filtros al navegar fuera y restoración al volver

### 🎯 PENDIENTE
- FASE 5: Testing E2E (15+ escenarios)
- FASE 6: Documentación + merge

---

## 2. Escenarios de Testing E2E

### 2.1 POLLING AUTOMÁTICO

#### TC-5.1.1: Polling cada 5 segundos
**Pasos**:
1. Abrir coordinación
2. Ver consola: debe mostrar "✅ Datos sincronizados desde BD:" cada 5s
3. Cambiar fecha (debe resetear polling)
4. Cambiar fecha de nuevo y esperar 10s
5. Verificar que hay 2+ logs de sincronización

**Criterio**: Logs aparecen cada ~5s, refetch se ejecuta

---

#### TC-5.1.2: Visibility API (pausa polling si página oculta)
**Pasos**:
1. Abrir coordinación
2. Ver logs: "✅ Datos sincronizados..."
3. Cambiar tab (Tab A → Tab B) (página escondida)
4. Esperar 10s en Tab B
5. Ver consola (en coordinación): logs se pausaron
6. Volver a Tab A (página visible)
7. Ver consola: debe haber "👁️ Página visible → reanudando polling"

**Criterio**: Polling pausa cuando tab está oculta, resume cuando es visible

---

#### TC-5.1.3: Cambio de fecha resetea polling
**Pasos**:
1. Notar timestamp de primer "✅ sincronización"
2. Click en botón siguiente fecha
3. Debe resetear polling (nuevo sync inmediato)
4. Ver consola: debe haber nuevo log con timestamp actualizado

**Criterio**: Cambio de fecha dispara refetch inmediato

---

### 2.2 FILTROS MULTICRITERIO

#### TC-5.2.1: Búsqueda universal (ID, cliente, dirección)
**Pasos**:
1. Abrir coordinación
2. En panel de filtros, escribir ID de una OT existente (ej "51")
3. Grid debe filtrar para mostrar solo OT #51
4. Escribir cliente inexistente
5. Grid debe estar vacío
6. Limpiar búsqueda
7. Grid debe mostrar todas las OTs

**Criterio**: Búsqueda funciona, grid actualiza sin recargar

---

#### TC-5.2.2: Filtro de localidades
**Pasos**:
1. Desplegar "📍 Localidades"
2. Seleccionar una ciudad (ej "San José")
3. Grid debe filtrar solo OTs en esa ciudad
4. Seleccionar otra ciudad
5. Grid suma OTs de ambas ciudades (OR lógica)
6. Desseleccionar una
7. Mostrar solo OTs de la otra ciudad

**Criterio**: Filtro de ciudades funciona, deseleccionar elimina del filtro

---

#### TC-5.2.3: Filtro de tipos
**Pasos**:
1. Seleccionar filtro "Reparación"
2. Grid muestra solo OTs de tipo repair
3. Seleccionar también "Instalación"
4. Grid muestra repair + install (OR lógica)
5. Deseleccionar todos
6. Grid muestra todas las OTs

**Criterio**: Checkboxes de tipos filtran correctamente

---

#### TC-5.2.4: Filtro de críticas
**Pasos**:
1. Activar toggle "Solo Críticas"
2. Grid muestra solo OTs con `is_critical=true` o `priority='high'`
3. Desactivar toggle
4. Grid muestra todas las OTs

**Criterio**: Toggle de críticas funciona

---

#### TC-5.2.5: Persistencia de filtros en sessionStorage
**Pasos**:
1. Aplicar filtro: búsqueda "San José" + ciudad "San José"
2. Navegar a otra página (ej /work-orders)
3. Volver a /coordination
4. Verificar que los filtros siguen aplicados

**Criterio**: sessionStorage persiste filtros entre navegación

---

### 2.3 DRAG & DROP (Con BD como fuente de verdad)

#### TC-5.3.1: Dropear OT en equipo causa refetch
**Pasos**:
1. Identificar OT #51 en backlog
2. Dropear en equipo X en horario 10:00
3. UI debe actualizar inmediatamente (optimistic)
4. Esperar ~5s (polling)
5. Verificar consola: debe haber "✅ Datos sincronizados..."
6. Refrescar página manualmente (F5)
7. OT #51 debe seguir asignada a equipo X

**Criterio**: Optimistic update visible, backend persiste, refetch sincroniza

---

#### TC-5.3.2: Dropear OT sin localStorage mantiene visible
**Pasos**:
1. Abrir coordinación
2. Limpiar localStorage manualmente (DevTools > Application > Clear all)
3. Dropear OT #52 en equipo Y
4. OT debe seguir visible (sin localStorage)
5. Refrescar página (F5)
6. OT #52 debe estar asignada a equipo Y

**Criterio**: Sin localStorage, OT visible por polling + BD

---

#### TC-5.3.3: Dropear OT en posición con colisión muestra error
**Pasos**:
1. OT #51 ya asignada a equipo X, 10:00-11:00
2. Intentar dropear OT #52 en equipo X, 10:30
3. Backend rechaza (409 Conflict)
4. UI muestra error (notificación roja en top-right)
5. OT #52 vuelve al backlog
6. Error desaparece después de 4s

**Criterio**: Error handling funciona, OT no se asigna si hay colisión

---

### 2.4 RESIZE (Redimensionamiento de duración)

#### TC-5.4.1: Resize actualiza duración y persiste
**Pasos**:
1. OT asignada con duración 60min
2. Clickear y arrastrar borde derecho de tarjeta
3. Duración visual debe cambiar en tiempo real
4. Soltar mouse
5. API PATCH a `/assign` con nueva duración
6. Esperar ~5s, polling debe sincronizar con BD
7. Refrescar página (F5)
8. Duración debe estar actualizada

**Criterio**: Resize funciona, persiste en BD, polling sincroniza

---

#### TC-5.4.2: Resize sin Authorization header
**Pasos**:
1. Limpiar token (DevTools > Application > Clear 'emerald_token')
2. Intentar resize
3. Error 401 debe mostrar "Sesión expirada"
4. Usuario debe poder refrescar página y loguearse nuevamente

**Criterio**: 401 handling correcto

---

### 2.5 OPTIMISTIC UPDATES

#### TC-5.5.1: Asignación optimistic + revert en error
**Pasos**:
1. Dropear OT #53 en equipo Z
2. Simultáneamente (antes de 500ms), desactivar internet (DevTools > Network > Offline)
3. UI muestra OT asignada => optimistic update
4. Backend falla
5. Esperar que error se propague
6. OT debe revertir al backlog

**Criterio**: Optimistic visible al instante, revert en error

---

### 2.6 UNASSIGN (Devolver al Backlog)

#### TC-5.6.1: Unassign actualiza backend y UI
**Pasos**:
1. Abrir DetailSheet de OT asignada
2. Click "Devolver al Backlog"
3. API PATCH `/unassign`
4. UI debe actualizar (OT desaparece de grid, aparece en backlog)
5. Refrescar página
6. OT debe estar en backlog

**Criterio**: Unassign funciona, persiste, refetch sincroniza

---

### 2.7 TIEMPO DE VIDA DEL TOKEN

#### TC-5.7.1: Token expirado muestra error legible
**Pasos**:
1. Editar token en localStorage manualmente (romper estructura)
2. Intentar asignar / desasignar OT
3. Error 401 debe mostrar "Sesión expirada"
4. Usuario puede refrescar página y loguearse

**Criterio**: Error handling para 401 es legible

---

### 2.8 PERFORMANCE

#### TC-5.8.1: Grid con 300+ OTs no laguea
**Pasos**:
1. Crear 300+ OTs en BD para una fecha
2. Abrir coordinación para esa fecha
3. Grid carga en <2s
4. Drag & drop fluido (60 FPS)
5. Filtros aplican en <500ms

**Criterio**: No hay lag visible, rendimiento aceptable

---

### 2.9 NAVEGACIÓN Y PERSISTENCIA

#### TC-5.9.1: Filtros + activeTimeBlock se pierden al navegar
**Pasos**:
1. CoordinationGridPage: aplicar filtro "San José" + seleccionar "Tarde"
2. Navegar a /work-orders
3. Volver a /coordination
4. Filtro debe estar aplicado (sessionStorage)
5. Turno debe ser "Tarde" (sessionStorage)

**Criterio**: sessionStorage persiste ambos estados

---

## 3. Manual Testing Checklist

### 3.1 Verificaciones Críticas
- [ ] Polling corre cada 5s (consola logs)
- [ ] Visibility API pausa polling si tab oculta
- [ ] Filtros se aplican sin recargar página
- [ ] Filtros persisten en sessionStorage
- [ ] Drag & drop funciona (optimistic + persiste en BD)
- [ ] Resize funciona (optimistic + persiste en BD)
- [ ] Unassign funciona
- [ ] Error 401 legible
- [ ] Error 409 legible
- [ ] sessionStorage restaura filtros + turno

### 3.2 Verificaciones de Regresión
- [ ] Tooltip de OT siguen visibles
- [ ] Sidebar backlog se actualiza
- [ ] DetailSheet abre/cierra correctamente
- [ ] Picker de fecha navega correctamente
- [ ] Botones de turno (mañana/tarde) funcionan

---

## 4. Comandos de Debugging (Console)

```javascript
// Ver si polling está activo
// Buscar logs "✅ Datos sincronizados desde BD:"

// Verificar que localStorage está limpio
localStorage.getItem('coordination_grid_2026-02-24') // null

// Ver sessionStorage de filtros
JSON.parse(sessionStorage.getItem('coordination_filters'))

// Ver activeTimeBlock
sessionStorage.getItem('coordination_activeTimeBlock')
```

---

## 5. Notas Importantes

### 5.1 Sin localStorage
La BD es ahora la **fuente de verdad** única. No hay snapshot local que pueda desincronizar.

### 5.2 Polling vs Optimistic Updates
- **Optimistic**: Actualiza UI inmediatamente (UX fluida)
- **Polling**: Sincroniza con BD cada 5s (consistencia garantizada)
- Ambos trabajan juntos: optimistic para velocidad, polling para verdad

### 5.3 sessionStorage
- OK para UI state (filtros, turno)
- NO para datos críticos (solo está en memoria del navegador, se limpia al cerrar)
- Mejor que localStorage porque no persiste entre sesiones

### 5.4 Pruebas Reales
- Pruebas con datos reales de BD (7090+ OTs)
- Probar con múltiples equipos
- Probar cambios de fecha
- Probar cambios de turno

---

## 6. Resultado Esperado

✅ **Todos los escenarios deben pasar** para considerar FASE 5 completa.

Si hay fallos:
1. Documentar exactamente qué falla
2. Ejecutar debuggen (ver punto 4)
3. Arreglar en el código correspondiente
4. Re-ejecutar test fallido + tests relacionados

---

**Próximo Paso**: FASE 6 (Documentación + merge)
