# Guía de Testing: Módulo Engineering/NOC

**Fecha:** 16 de Enero de 2026  
**Objetivo:** Validar la integración completa backend + frontend

---

## 🧪 OPCIÓN 1: Testing con cURL (API directa)

### Test 1: Crear tarea reactiva (desde ticket)

```bash
# 1. Crear tarea asociada al ticket #1
curl -X POST http://localhost:8500/api/v2/engineering/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": 1,
    "title": "Revisar fibra cortada en Zona Norte",
    "description": "Cliente sin servicio desde 14:00. Verificar corte en splitter.",
    "task_type": "incident",
    "priority": "critical"
  }'

# Respuesta esperada (201):
{
  "id": 1,
  "ticket_id": 1,
  "title": "Revisar fibra cortada en Zona Norte",
  "status": "backlog",
  "priority": "critical",
  "created_at": "2026-01-16T00:45:00Z",
  ...
}
```

### Test 2: Verificar que el ticket cambió de estado

```bash
# 2. Obtener ticket #1 (debe tener status: waiting_internal)
curl http://localhost:8500/api/v2/tickets/1

# Buscar en la respuesta:
{
  "id": 1,
  "status": "waiting_internal",  # ← Cambió automáticamente
  ...
}
```

### Test 3: Listar tareas del ticket

```bash
# 3. Obtener todas las tareas del ticket #1
curl "http://localhost:8500/api/v2/engineering/tasks?ticket_id=1"

# Respuesta esperada:
[
  {
    "id": 1,
    "ticket_id": 1,
    "title": "Revisar fibra cortada en Zona Norte",
    "status": "backlog",
    ...
  }
]
```

### Test 4: Actualizar estado de tarea

```bash
# 4. Pasar tarea a "in_progress"
curl -X PATCH http://localhost:8500/api/v2/engineering/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to_id": 2
  }'

# Respuesta esperada (200):
{
  "id": 1,
  "status": "in_progress",
  "assigned_to_id": 2,
  "started_at": "2026-01-16T00:50:00Z",  # ← Timestamp automático
  ...
}
```

### Test 5: Completar tarea (trigger estado de ticket)

```bash
# 5. Completar tarea
curl -X POST "http://localhost:8500/api/v2/engineering/tasks/1/complete?resolution_note=Fibra%20reparada.%20Cliente%20online.%20Speedtest%20OK."

# Respuesta esperada (200):
{
  "id": 1,
  "status": "completed",
  "resolution_note": "Fibra reparada. Cliente online. Speedtest OK.",
  "completed_at": "2026-01-16T00:55:00Z",
  ...
}

# 6. Verificar que ticket cambió a "attention_required"
curl http://localhost:8500/api/v2/tickets/1

# Buscar:
{
  "status": "attention_required",  # ← Cambió de waiting_internal
  ...
}

# 7. Verificar timeline del ticket (debe tener evento "✓ Tarea completada")
curl http://localhost:8500/api/v2/tickets/1/timeline

# Buscar último evento:
{
  "event_type": "status_change",
  "content": "✓ Tarea completada: Revisar fibra cortada en Zona Norte",
  ...
}
```

### Test 6: Rechazar tarea (trigger estado de ticket)

```bash
# Crear otra tarea para testear rechazo
curl -X POST http://localhost:8500/api/v2/engineering/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": 1,
    "title": "Reemplazar ONU defectuosa",
    "description": "ONU no responde a ping",
    "task_type": "incident",
    "priority": "high"
  }'

# Rechazar tarea
curl -X POST "http://localhost:8500/api/v2/engineering/tasks/2/reject?rejection_reason=Hardware%20defectuoso.%20Requiere%20RMA%20del%20proveedor."

# Verificar ticket volvió a "pending"
curl http://localhost:8500/api/v2/tickets/1
# Buscar: "status": "pending"
```

### Test 7: Estadísticas del dashboard

```bash
curl http://localhost:8500/api/v2/engineering/stats/dashboard

# Respuesta esperada:
{
  "total_tasks": 2,
  "by_status": {
    "completed": 1,
    "rejected": 1
  },
  "by_priority": {
    "critical": 1,
    "high": 1
  },
  "by_type": {
    "incident": 2
  },
  "assigned_to_me": 0,
  "critical_count": 0
}
```

---

## 🖥️ OPCIÓN 2: Testing desde Frontend (UI)

### Prerequisito: Verificar que frontend esté corriendo

```bash
# Verificar contenedor frontend
docker ps | grep emerald_frontend

# Debería estar Up
# Acceder a: http://localhost (puerto 80/443)
```

### Flujo de Testing Completo:

#### PASO 1: Navegar al Detalle de un Ticket

1. Abrir navegador: `http://localhost`
2. Login con credenciales (admin@emerald.com / password que uses)
3. Ir a **Tickets** → Click en cualquier ticket existente
4. Deberías ver el detalle del ticket

#### PASO 2: Verificar Botón "Derivar a NOC / Ingeniería"

**Ubicación:** Sidebar derecho, sección "Acciones"

**Apariencia esperada:**
- Botón con borde púrpura
- Texto: "🔧 Derivar a NOC / Ingeniería"
- Solo visible si ticket está en estado de soporte (open, in_progress, pending)

#### PASO 3: Crear Tarea de Ingeniería

1. Click en **"Derivar a NOC / Ingeniería"**
2. Se abre un Modal con:
   - Header: "🔧 Derivar a NOC / Ingeniería"
   - Info del ticket de origen (morado)
   - Campo "Título" (pre-rellenado: "Revisión técnica ticket #X")
   - Select "Prioridad" (default: Media)
   - Textarea "Descripción técnica"

3. **Completar form:**
   ```
   Título: Revisar conectividad fibra óptica
   Prioridad: Alta
   Descripción: Cliente reporta pérdida de señal intermitente.
   Verificar:
   - Niveles de potencia en OLT
   - Atenuación en el recorrido
   - Estado del splitter
   ```

4. Click en **"Derivar a Ingeniería"**

#### PASO 4: Verificaciones Post-Submit

**Debe ocurrir:**

1. ✅ Modal se cierra
2. ✅ Toast/notificación de éxito (si implementaste Sonner)
3. ✅ El ticket se recarga automáticamente
4. ✅ **Estado del ticket cambia a "waiting_internal"** (badge morado)
5. ✅ Aparece nueva sección **"Tareas de Ingeniería"** con 1 tarea

#### PASO 5: Verificar Visualización de Tarea

**En la sección "Tareas de Ingeniería" deberías ver:**

```
┌─────────────────────────────────────────────────────────┐
│ #1  🔥                                    [Planificación]│
│ Revisar conectividad fibra óptica                       │
│                                                          │
│ Cliente reporta pérdida de señal intermitente...        │
│                                                          │
│ ⚠ Alta  👤 Sin asignar                                  │
│                                                          │
│ ─────────────────────────────────────────────────────   │
│ Creada: ene 16, 00:45                                   │
└─────────────────────────────────────────────────────────┘
```

**Elementos a verificar:**
- ✅ ID de tarea (#1)
- ✅ Icono de tipo (🔥 = incident)
- ✅ Badge de estado (color zinc/gris = backlog)
- ✅ Título
- ✅ Descripción (primeras 2 líneas)
- ✅ Prioridad con color (naranja para "Alta")
- ✅ "Sin asignar" (porque no asignamos ingeniero)
- ✅ Timestamp de creación

#### PASO 6: Verificar Timeline del Ticket

Scroll a la sección **"Timeline"** del ticket.

**Debe aparecer un nuevo evento:**
```
🔧 Tarea de ingeniería creada: Revisar conectividad fibra óptica
hace X minutos
```

---

## 🔍 OPCIÓN 3: Testing con Swagger UI

### Acceder a la documentación interactiva:

1. Abrir navegador: `http://localhost:8500/docs`
2. Buscar sección **"Engineering/NOC"**

### Endpoints disponibles para testear:

1. **POST /api/v2/engineering/tasks** - Crear tarea
2. **GET /api/v2/engineering/tasks** - Listar tareas
3. **GET /api/v2/engineering/tasks/{task_id}** - Obtener detalles
4. **PATCH /api/v2/engineering/tasks/{task_id}** - Actualizar
5. **POST /api/v2/engineering/tasks/{task_id}/complete** - Completar
6. **POST /api/v2/engineering/tasks/{task_id}/reject** - Rechazar
7. **DELETE /api/v2/engineering/tasks/{task_id}** - Eliminar
8. **GET /api/v2/engineering/stats/dashboard** - Estadísticas

### Ejemplo de uso en Swagger:

1. Expandir **POST /api/v2/engineering/tasks**
2. Click en **"Try it out"**
3. Editar el JSON del Request Body:
   ```json
   {
     "ticket_id": 1,
     "title": "Test desde Swagger",
     "description": "Probando creación de tarea desde Swagger UI",
     "task_type": "incident",
     "priority": "medium"
   }
   ```
4. Click en **"Execute"**
5. Verificar Response (201 Created)

---

## ✅ Checklist de Validación Completa

### Backend
- [ ] POST /tasks crea tarea y actualiza ticket a waiting_internal
- [ ] GET /tasks?ticket_id=X retorna tareas del ticket
- [ ] PATCH /tasks/{id} con status actualiza timestamps
- [ ] POST /tasks/{id}/complete cambia ticket a attention_required
- [ ] POST /tasks/{id}/reject cambia ticket a pending
- [ ] GET /stats/dashboard retorna conteos correctos
- [ ] Timeline del ticket registra eventos de ingeniería

### Frontend
- [ ] Botón "Derivar a NOC / Ingeniería" visible en tickets
- [ ] Modal se abre con form correcto
- [ ] Validaciones funcionan (título min 5, descripción min 10)
- [ ] Submit crea tarea y cierra modal
- [ ] Ticket se recarga y muestra nuevo estado
- [ ] Sección "Tareas de Ingeniería" aparece
- [ ] Tareas se visualizan con badges de colores
- [ ] Prioridad muestra color correcto
- [ ] Resoluciones/rechazos se muestran en cajas especiales

### Base de Datos
- [ ] Tabla engineering_tasks tiene registros
- [ ] FK a tickets funciona (CASCADE)
- [ ] Valores de ENUM son correctos
- [ ] timeline_data (JSONB) se guarda correctamente

---

## 🐛 Troubleshooting

### Error: "No module named 'src.core.auth'"
**Solución:** Ya corregido. El servicio usa función local `get_user_id()`.

### Error: "type engineering_task_type_enum already exists"
**Solución:** Ya corregido en migración con `create_type=False`.

### Frontend: "Cannot read property 'length' of undefined"
**Causa:** API retorna array directo, no objeto con `items`.
**Solución:** Verificar que `getTasksByTicket()` maneje respuesta correctamente.

### Ticket no cambia de estado
**Causa:** Transición de estado inválida en service.
**Debug:** Revisar logs del backend: `docker logs emerald_backend --tail 50`

### Modal no se cierra
**Causa:** Estado `isSubmitting` no se resetea.
**Solución:** Verificar bloque `finally` en `handleSubmit()`.

---

## 📊 Datos de Testing Recomendados

### Crear tickets de prueba (si no hay):

```bash
# Crear ticket #1
curl -X POST http://localhost:8500/api/v2/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Cliente sin servicio - Fibra cortada",
    "description": "Cliente reporta sin internet desde 14:00",
    "priority": "high",
    "status": "open",
    "connection_id": 1
  }'
```

### Prioridades a testear:
- `low` → Color zinc (gris claro)
- `medium` → Color amber (amarillo)
- `high` → Color orange (naranja)
- `critical` → Color rose (rojo)

### Estados a testear:
- `backlog` → Zinc (gris)
- `in_progress` → Cyan (azul)
- `testing` → Amber (amarillo)
- `completed` → Emerald (verde)
- `rejected` → Rose (rojo)

---

## 🎯 Testing de Flujo Completo (E2E)

### Escenario: "Cliente sin servicio → Tarea de ingeniería → Resolución"

1. **Crear ticket** (Soporte)
   ```bash
   POST /api/v2/tickets
   → Ticket #5, status: open
   ```

2. **Derivar a ingeniería** (UI)
   ```
   Click botón "Derivar a NOC / Ingeniería"
   → Modal → Submit
   → Ticket #5, status: waiting_internal
   → Tarea #3, status: backlog
   ```

3. **Asignar ingeniero** (API)
   ```bash
   PATCH /api/v2/engineering/tasks/3
   { "assigned_to_id": 2, "status": "in_progress" }
   → Tarea #3, status: in_progress
   ```

4. **Completar tarea** (API)
   ```bash
   POST /api/v2/engineering/tasks/3/complete
   ?resolution_note=Fibra reparada. OK.
   → Tarea #3, status: completed
   → Ticket #5, status: attention_required
   ```

5. **Cerrar ticket** (UI)
   ```
   Operador ve ticket en "attention_required"
   → Lee resolución de ingeniería
   → Cierra ticket
   → Ticket #5, status: closed
   ```

---

**Testing completo listo** ✨

Próximos pasos opcionales:
- Unit tests con Jest/Vitest
- Integration tests con Playwright
- Load testing con k6
