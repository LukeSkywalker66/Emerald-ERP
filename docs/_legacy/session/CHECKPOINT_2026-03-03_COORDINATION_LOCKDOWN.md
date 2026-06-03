# Bloqueo de Coordinaciones (NASA-Grade) - Implementación 2026-03-03

## Resumen Ejecutivo

Se han implementado validaciones a nivel backend para **bloquear ediciones de Órdenes de Trabajo completadas** y **prevenir asignaciones a fechas pasadas**, manteniendo la integridad de datos y permitiendo opciones coherentes para trabajos incompletos.

### Cambios Principales
- ✅ **Guard Function**: `validate_coordination_not_locked()` - Validación centralizada en todos los endpoints de mutación
- ✅ **Nuevo Endpoint**: `POST /v2/work-orders/{id}/mark-incomplete` - Para marcar trabajos como no realizados
- ✅ **Protección**: Bloquea creación de OTs para fechas pasadas (5 min gracia)
- ✅ **Estados Inmutables**: `completed` y `failed` no se pueden editar
- ✅ **Auditoría**: Todos los intentos bloqueados quedan registrados en timeline

---

## Máquina de Estados (Actualizada)

```
pending_planning
      ↓
coordinated (fecha pactada, sin equipo)
      ↓
scheduled (fecha + equipo asignado)
      ↓
assigned (deprecated, legacy)
      ↓
in_progress (técnico en sitio)
      ↓
completed ← INMUTABLE, no se puede editar
      ↗
[incompleto] -─→ en técnico, puede:
                  1. reschedule (PATCH con nueva fecha)
                  2. reopen_backlog (DELETE assignment)
                  3. create_new_from_ticket (nueva OT)

      ↓
failed ← INMUTABLE, no se puede editar
```

---

## Reglas de Bloqueo (Backend Authority)

### Regla 1: OTs Completadas/Fallidas = Inmutables
```
IF status IN (completed, failed) THEN
    BLOCK all PATCH/PUT operations
    RETURN HTTP 423 (LOCKED)
    REASON: "LOCKED_COMPLETED_OR_FAILED"
```

**Excepciones:**
- `PUT /work-orders/{id}/reopen` → Permite técnico/admin reabrir (con ventana de 2h para técnico)

### Regla 2: No Asignar a Fechas Pasadas
```
IF operation IN (assign, reassign) THEN
    IF scheduled_start < (now - 5min) THEN
        BLOCK assignment
        RETURN HTTP 423 (LOCKED)
        REASON: "LOCKED_PAST_DATE"
```

**Grace Period:** 5 minutos tolerancia para jitter/timezones

### Regla 3: OTs Editables (Pendientes, Coordinadas, In Progress)
```
IF status IN (pending_planning, coordinated, scheduled, assigned, in_progress) THEN
    ALLOW all mutations (reschedule, cambio de equipo, etc.)
```

---

## Endpoints Modificados

### 1. `PATCH /work-orders/{work_order_id}/assign`
**Cambios:**
- Ahora valida que `scheduled_start` no esté en el pasado
- Bloquea si OT es `completed` o `failed`
- Respuesta 423 con headers adicionales si está bloqueada

**Request:**
```json
{
  "team_id": 5,
  "scheduled_start": "2026-03-15T10:00:00Z",
  "estimated_duration": 60
}
```

**Respuestas:**
```
✅ 200 OK: Asignación exitosa
❌ 423 LOCKED: OT completada o fecha pasada
   Headers: 
   - X-Locked-Reason: (LOCKED_COMPLETED | LOCKED_PAST_DATE)
   - X-Work-Order-Status: completed
   - X-Proposed-Date: 2026-02-10T08:00:00Z
```

### 2. `PATCH /work-orders/{work_order_id}`
**Cambios:**
- Valida que OT no esté completada antes de permitir cambios
- Previene ediciones de OTs finalizadas

**Errores:**
```
❌ 423 LOCKED: "Orden no puede ser modificada. Estado: completed (inmutable)"
```

### 3. `PATCH /work-orders/{work_order_id}/unassign`
**Cambios:**
- Bloquea desasignación de OTs completadas/fallidas

---

## Nuevo Endpoint: Mark-Incomplete

### `POST /work-orders/{work_order_id}/mark-incomplete`

Cuando un técnico/coordinador determina que el trabajo NO se completó (cliente no estaba, requiere replanteo, etc.), este endpoint retorna las opciones disponibles.

**Request:**
```json
{
  "reason": "Cliente no estaba disponible"
}
```

**Response (200 OK):**
```json
{
  "work_order_id": 123,
  "status": "in_progress",
  "ticket_id": 456,
  "reason": "Cliente no estaba disponible",
  "options": {
    "reschedule": {
      "description": "Reprogramar para otra fecha/hora",
      "available": true,
      "action": "PATCH /{work_order_id}",
      "params": {
        "scheduled_start": "2026-03-15T14:00:00Z",
        "estimated_duration": 90
      }
    },
    "reopen_backlog": {
      "description": "Devolver al backlog para reprogramación manual",
      "available": true,
      "action": "DELETE /{work_order_id}/assign",
      "effect": "Quita equipo, vuelve a coordinated/pending_planning"
    },
    "create_new_from_ticket": {
      "description": "Cerrar esta OT y crear nueva desde ticket original",
      "available": true,
      "action": "POST /v2/work-orders",
      "effect": "Nueva OT con misma conexión/ticket, this WO marked as failed",
      "reason": "Para replanteo completo o cambio de scope"
    }
  },
  "message": "Elige una opción para continuar con esta OT"
}
```

---

## Guard Function (Backend)

**Archivo:** `backend/src/routers/work_orders_guards.py`

```python
def validate_coordination_not_locked(
    wo: WorkOrder,
    db: Session,
    current_user: User,
    operation: str = "update",  # "update", "assign", "unassign"
    override_reason: str = None
):
    """
    Valida si una OT puede ser modificada.
    
    - Bloquea OTs en estado 'completed' o 'failed'
    - Bloquea asignaciones a fechas pasadas
    - Permite override de admin con auditoría
    """
```

**Usa HTTP 423 (LOCKED)** como status code estándar para bloqueos, con headers adicionales:
```
X-Locked-Reason: (LOCKED_COMPLETED_OR_FAILED | LOCKED_PAST_DATE)
X-Work-Order-Status: completed
X-Proposed-Date: 2026-02-10T08:00:00Z
X-Current-Time: 2026-03-03T15:30:00Z
```

---

## Auditoría y Logging

### Timeline Events
Todos los intentos bloqueados y acciones incompletas se registran en `ticket_timeline`:

```python
# Ejemplo: Marca como incompleta
meta_data = {
    "work_order_id": 123,
    "status": "in_progress",
    "reason": "Cliente no estaba disponible",
    "marked_incomplete_by": "Tech001",
    "timestamp": "2026-03-03T15:30:00Z"
}

# Ejemplo: Intento bloqueado (en header de respuesta, el frontend puede loguear)
X-Locked-Reason: LOCKED_PAST_DATE
```

### Override de Admin (Futuro)
Si se implementa override para admin, queda registro:
```
"✓ OVERRIDE ADMIN: ASSIGN en OT #123"
meta_data: {
    "override_reason": "Excepción autori...
    "ip_address": "192.168.1.1",
    "timestamp": "2026-03-03T15:30:00Z"
}
```

---

## Flujos de Negocio Soportados

### Flujo 1: Reprogramar Trabajo Incompleto
```
1. Técnico completa tarea pero FALLA (cliente no está)
2. Sistema: POST mark-incomplete → retorna opciones
3. Coordinador: PATCH /assign con nueva fecha
4. Sistema: Valida que fecha futura sea válida
5. ✅ OT re-asignada a nuevo slot horario
```

### Flujo 2: Volver al Backlog
```
1. Técnico: Markincomplete ("Requiere replanteo")
2. Coordinador: PATCH /unassign (quita equipo)
3. Sistema: Estado vuelve a "coordinated"
4. ✅ OT espera reprogramación manual
```

### Flujo 3: Nueva OT desde Ticket
```
1. Técnico: Mark-incomplete ("Cambio de scope")
2. Coordinador: POST /work-orders (nueva desde ticket)
3. Sistema: Nueva OT con estado "pending_planning"
4. Vieja OT: Cierra en estado "failed"
5. ✅ Nuevo flujo coordinación inicia
```

### Flujo 4: Bloqueo de Edición (OT Completada)
```
1. OT completada hace 30 minutos
2. Coordinador: Intenta PATCH (cambiar fecha)
3. Sistema: ❌ 423 LOCKED "Estado: completed (inmutable)"
4. Coordinador: Debe usar PUT /reopen (dentro de ventana)
5. ✅ Si < 2h desde cierre y es admin/técnico
```

---

## Consideraciones de UX (Frontend)

### Estados Deshabilitados
El frontend debe mostrar:
- 🔒 Indicador de "Bloqueada" para OTs completadas
- ❌ Botones PATCH/DELETE deshabilitados
- ℹ️ Tooltip: "OT completada. Use reopen si es dentro de 2h (admin/técnico)"

### Respuestas 423
El frontend debe:
```javascript
if (response.status === 423) {
    const reason = response.headers['X-Locked-Reason'];
    // LOCKED_PAST_DATE → "No se puede asignar a fecha pasada"
    // LOCKED_COMPLETED → "OT completada, inmutable"
    toast.error(`Operación bloqueada: ${reason}`);
}
```

### Mark-Incomplete en Grid
Cuando técnico marca como incompleta:
```
1. Mostrar modal con 3 opciones
2. "Reprogramar" → Abre datepicker
3. "Al backlog" → Click → DELETE assign
4. "Nueva OT" → Link a creación nova OT
```

---

## Validación de Implementación

✅ **Backend Checks:**
- [ ] `work_orders_guards.py` creado con `validate_coordination_not_locked()`
- [ ] Import en `work_orders.py` agregado
- [ ] `assign_work_order_to_team()` incluye guardia + validación fecha pasada
- [ ] `update_work_order()` bloquea ediciones de completed/failed
- [ ] `unassign_work_order()` bloquea desasignación de completadas
- [ ] `mark_work_order_incomplete()` endpoint creado
- [ ] Sintaxis Python validada ✅

✅ **Frontend Checks:**
- [ ] CoordinationSheet.jsx muestra estado "lockout" visual
- [ ] Botones deshabilitados si OT está completed
- [ ] Manejo de 423 responses con mensajes claros
- [ ] Grid muestra 🔒 para OTs completadas

❓ **Future Work:**
- [ ] Feature flag para rolling out de bloqueos
- [ ] Métricas de "intentos bloqueados" por usuario/fecha
- [ ] Override de admin con auditoría completa
- [ ] Tolerancia configurable para "fecha pasada" (actualmente 5 min hardcoded)

---

## Testing Recomendado

### E2E Test Suite

```python
# test_coordination_lockdown.py

def test_cannot_assign_to_past_date():
    # OT pasada hace 10 min
    past_date = datetime.now() - timedelta(minutes=10)
    response = assign_work_order(team_id=1, date=past_date)
    assert response.status_code == 423
    assert "LOCKED_PAST_DATE" in response.headers

def test_cannot_edit_completed_ot():
    # OT completada
    ot = create_and_complete_work_order()
    response = patch_work_order(ot.id, duration=90)
    assert response.status_code == 423
    assert "LOCKED_COMPLETED" in response.headers

def test_reschedule_incomplete_work():
    # OT in_progress marcada incompleta
    ot = create_scheduled_work_order()
    mark_incomplete(ot.id, reason="No disponible")
    # Coordinador reprograma
    new_date = datetime.now() + timedelta(days=1)
    response = patch_work_order(ot.id, scheduled_start=new_date)
    assert response.status_code == 200
    assert response.json()["status"] == "scheduled"
```

---

## Referencias

- **Architectural Pattern:** Backend authority for authorization + Frontend UX hints
- **HTTP Status Code:** 423 LOCKED per RFC 2518 (WebDAV)
- **Audit Trail:** via TicketTimeline.meta_data (JSONB)
- **Grace Period:** 5 minutos para tolerancia de timezones/jitter
- **User Roles:** Admin = all permissions, Coordinator = limited, Technician = field role

