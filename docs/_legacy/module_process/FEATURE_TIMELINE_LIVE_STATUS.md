# ✅ Feature: Timeline Live Status (Estados Dinámicos en Bitácora)

**Fecha:** 8 de enero de 2026  
**Branch:** `feature/timeline-live-status`  
**Commit:** `beb45fe`

---

## 📋 Problema Original

Cuando se creaba una OT, el evento en la bitácora mostraba:
```
"OT #42 generada" + status: "pending_planning" (snapshot del momento)
```

Pero si la OT avanzaba después (ej: técnico la completa):
```
OT #42 → status: "completed" (en la realidad)
Bitácora → sigue mostrando "pending_planning" (desactualizado)
```

❌ **Confuso:** El usuario veía estados inconsistentes entre sidebar y bitácora.

---

## ✅ Solución Implementada

### Backend: Estados Actuales Dinámicos

**Archivo:** `backend/src/routers/tickets.py`

**Cambios:**

1. **Actualizar `_timeline_to_response()`** para aceptar sesión de BD:
```python
def _timeline_to_response(event: TicketTimeline, db: Optional[Session] = None):
    meta = dict(event.meta_data) if event.meta_data else {}
    
    # Si es evento OT_EVENT, traer status ACTUAL
    if event.event_type == TicketTimelineEventType.ot_event and meta.get('work_order_id') and db:
        wo = db.get(WorkOrder, meta['work_order_id'])
        if wo:
            # Incluir status actual (live), no snapshot histórico
            meta['current_status'] = wo.status.value
            meta['current_ot_type'] = wo.ot_type.value
    
    return TimelineEventResponse(
        id=event.id,
        event_type=event.event_type,
        content=event.content,
        created_at=event.created_at,
        author_name=_safe_name(event.author),
        meta_data=meta,
    )
```

2. **Pasar `db` al llamar la función:**
```python
# En GET /tickets/{id}
timeline = [_timeline_to_response(ev, db) for ev in timeline_events]
```

**Resultado:** 
```json
{
  "event_type": "OT_EVENT",
  "content": "Orden de trabajo generada (repair)",
  "meta_data": {
    "work_order_id": 42,
    "ot_type": "repair",
    "current_status": "completed",      // ← ACTUAL (live)
    "current_ot_type": "repair"
  }
}
```

---

### Frontend: Badge Dinámico con Colores

**Archivo:** `frontend/src/components/tickets/TicketTimeline.jsx`

**Cambios:**

1. **Mapeo de colores por estado:**
```jsx
const statusColorMap = {
  'pending_planning': 'bg-zinc-600 text-zinc-100',   // Gris (pendiente)
  'assigned': 'bg-blue-600 text-blue-100',            // Azul (asignada)
  'in_progress': 'bg-amber-600 text-amber-100',       // Ámbar (en progreso)
  'completed': 'bg-emerald-600 text-emerald-100',     // Verde (completada)
  'failed': 'bg-red-600 text-red-100',                // Rojo (fallida)
};
```

2. **Renderizado de card OT con status dinámico:**
```jsx
if (event.event_type === 'OT_EVENT' && event.meta_data?.work_order_id) {
  const currentStatus = event.meta_data?.current_status || 'pending_planning';
  const statusColor = statusColorMap[currentStatus];
  
  return (
    <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-emerald-200 font-semibold">
          OT #{event.meta_data.work_order_id}
        </p>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
          {getStatusLabel(currentStatus)}
        </span>
      </div>
      {/* ... resto del contenido */}
    </div>
  );
}
```

**Resultado visual:**
```
┌─────────────────────────────────────────────┐
│ OT #42                        [Completada]  │ ← Badge con color dinámico
│                                             │
│ Orden de trabajo generada (repair)         │
│                                             │
│ 08/01/2026 15:30:45        por Juan Pérez │
└─────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo

### Antes (Problema)
```
1. Crear OT #42 → status: pending_planning
   Bitácora: muestra "pending_planning" (snapshot guardado)

2. Técnico asigna OT → status: assigned
   Bitácora: SIGUE mostrando "pending_planning" ❌

3. Técnico completa OT → status: completed
   Bitácora: SIGUE mostrando "pending_planning" ❌ ← CONFUSO
```

### Después (Solución)
```
1. Crear OT #42 → status: pending_planning
   Bitácora: muestra "pending_planning" (badge gris)

2. Técnico asigna OT → status: assigned
   Bitácora: ACTUALIZA a "assigned" (badge azul) ✓

3. Técnico completa OT → status: completed
   Bitácora: ACTUALIZA a "completed" (badge verde) ✓ ← CONSISTENTE
```

---

## 🧹 Limpieza de Eventos (Mantener Bitácora Limpia)

### NO Generamos Logs Para:
- ❌ `pending_planning` → `assigned` (cambio interno)
- ❌ `assigned` → `in_progress` (técnico llega a sitio)
- ❌ `in_progress` → `completed` (auto-sincronización)

### SÍ Mantenemos Logs Para:
- ✅ Creación de OT (evento inicial)
- ✅ **Resolución final** (nuevo evento cuando técnico completa con categoría + fotos)
- ✅ Notas manuales del operador
- ✅ Cambios de ticket (status, prioridad, asignación)

---

## 📊 Comparación: Snapshot vs. Live

| Aspecto | Snapshot (Antes) | Live (Después) |
|---------|------------------|----------------|
| **Cuando se actualiza** | Solo al crear | En cada GET /tickets/{id} |
| **Muestra** | Estado histórico | Estado actual |
| **Inconsistencia** | Sí (desactualizado) | No (siempre sincronizado) |
| **Caso de uso** | Auditoría pura | UX en tiempo real |
| **Impacto BD** | Ninguno (usa meta_data guardado) | Mínimo (1 JOIN adicional por OT) |

---

## 🔧 Próximas Mejoras Opcionales

1. **Caché en frontend:** Guardar status de OTs en contexto para evitar refetch
2. **WebSocket real-time:** Actualizar bitácora en tiempo real sin refresh
3. **Historial de cambios:** Evento separado `OT_STATUS_CHANGED` para auditoría completa
4. **Filtro en UI:** "Mostrar solo OTs con status actual: Completed"

---

## ✅ Testing Checklist

- [x] GET /tickets/{id} retorna `current_status` en meta_data
- [x] TicketTimeline.jsx renderiza badge con color correcto
- [x] Al cambiar status de OT, bitácora actualiza al recargar página
- [x] Colores corresponden a estados (verde=completed, ámbar=in_progress, etc)
- [x] No hay errores si work_order_id no existe (fallback a default)

---

**Status:** ✅ FEATURE LISTA PARA MERGE A DEVELOP
