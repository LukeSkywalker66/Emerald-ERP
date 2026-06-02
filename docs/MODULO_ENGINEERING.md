# Módulo Engineering/NOC - Documentación de Implementación

**Fecha:** 16 de Enero de 2026 (revisado 02 Jun 2026)  
**Estado:** ✅ Implementado y desplegado

## 📋 Resumen

Módulo completo para gestión de tareas de ingeniería y operaciones NOC (Network Operations Center). Permite manejar dos flujos de trabajo:
1. **Reactivo**: Tareas derivadas de tickets de soporte (support-driven)
2. **Proactivo**: Tareas de mantenimiento e infraestructura internas

---

## 🗂️ Arquitectura

### Modelos (SQLAlchemy 2.0)
**Archivo:** `backend/src/models/engineering.py`

```python
# Enums
EngineeringTaskType: incident | maintenance | project
EngineeringTaskPriority: low | medium | high | critical
EngineeringTaskStatus: backlog | in_progress | testing | completed | rejected

# Modelo Principal
EngineeringTask:
  - id (PK)
  - ticket_id (FK opcional - NULL para proactivas)
  - title, description
  - task_type, priority, status
  - assigned_to_id (FK users)
  - created_by_id (FK users)
  - scheduled_date, started_at, completed_at
  - resolution_note, rejection_reason
  - timeline_data (JSONB - histórico de cambios)
  - created_at, updated_at (timestamps)
```

**Relaciones:**
- `ticket` → Ticket (back_populates="engineering_tasks")
- `assigned_to` → User
- `created_by` → User

---

### Extensiones a Modelos Existentes

**Archivo:** `backend/src/models/tickets.py`

1. **Nuevos estados en TicketStatus:**
   - `waiting_internal`: Esperando acción de ingeniería
   - `attention_required`: Ingeniería completó, requiere atención de soporte

2. **Nueva relación en Ticket:**
   ```python
   engineering_tasks: Mapped[list["EngineeringTask"]] = relationship(...)
   ```

---

### Schemas (Pydantic)
**Archivo:** `backend/src/schemas/engineering.py`

- `EngineeringTaskBase`: Campos comunes
- `EngineeringTaskCreate`: Para POST /tasks
- `EngineeringTaskUpdate`: Para PATCH /tasks/{id}
- `EngineeringTaskRead`: Respuesta completa con relaciones
- `EngineeringTaskListResponse`: Respuesta compacta para listados
- `EngineeringTaskDetailResponse`: Detalles + timeline_data
- `EngineeringTaskStatsResponse`: Estadísticas para dashboard

**Schemas auxiliares:**
- `UserBasicResponse`: Datos mínimos de usuario
- `TicketBasicResponse`: Datos mínimos de ticket

---

### Service Layer (Lógica de Negocio)
**Archivo:** `backend/src/services/engineering_service.py`

#### Métodos CRUD:
- `create_task(payload, creator_id)` → EngineeringTaskRead
- `get_task(task_id)` → EngineeringTaskDetailResponse
- `list_tasks(...)` → List[EngineeringTaskListResponse]
- `update_task(task_id, payload, user_id)` → EngineeringTaskRead
- `delete_task(task_id)` → None (solo si status=backlog)

#### Máquina de Estados:
**Método:** `_transition_status(task, new_status, user_id)`

**Transiciones válidas:**
```
backlog → in_progress (asignación a ingeniero)
        → rejected (cancelación)

in_progress → testing (validación iniciada)
            → rejected (cancelación)

testing → completed (éxito → Ticket: attention_required)
        → rejected (fallo → Ticket: pending)
        → in_progress (volver a trabajar)
```

**Side-effects críticos:**
- `completed`: Ticket pasa a `attention_required` + Timeline "✓ Tarea completada"
- `rejected`: Ticket vuelve a `pending` + Timeline "✗ Tarea rechazada"

#### Analytics:
- `get_stats(user_id)` → EngineeringTaskStatsResponse

---

### REST API (FastAPI)
**Archivo:** `backend/src/routers/engineering.py`

**Base URL:** `/api/v2/engineering`

#### Endpoints:

1. **POST /tasks** - Crear tarea
   - Body: `EngineeringTaskCreate`
   - Response: `EngineeringTaskRead` (201)
   - Lógica: Si ticket_id, actualiza Ticket → waiting_internal

2. **GET /tasks** - Listar tareas
   - Query Params: `status`, `assigned_to_id`, `task_type`, `priority`, `ticket_id`, `limit`, `offset`
   - Response: `List[EngineeringTaskListResponse]`

3. **GET /tasks/{task_id}** - Obtener detalles
   - Response: `EngineeringTaskDetailResponse`

4. **PATCH /tasks/{task_id}** - Actualizar tarea
   - Body: `EngineeringTaskUpdate`
   - Response: `EngineeringTaskRead`
   - Lógica: Si payload.status, ejecuta transición de estado

5. **POST /tasks/{task_id}/complete** - Completar tarea
   - Query: `resolution_note` (string)
   - Response: `EngineeringTaskRead`

6. **POST /tasks/{task_id}/reject** - Rechazar tarea
   - Query: `rejection_reason` (string)
   - Response: `EngineeringTaskRead`

7. **DELETE /tasks/{task_id}** - Eliminar tarea
   - Response: 204 No Content
   - Restricción: Solo si status=backlog

8. **GET /stats/dashboard** - Dashboard de estadísticas
   - Response: `EngineeringTaskStatsResponse`

---

### Migración Alembic
**Archivo:** `backend/alembic/versions/j9k0l1m2n3o4p_add_engineering_module.py`

**Revision:** `j9k0l1m2n3o4p`  
**Down Revision:** `975f880c8062`

**Cambios aplicados:**
1. Extender `ticket_status_enum` con `waiting_internal` y `attention_required`
2. Crear ENUMs: `engineering_task_type_enum`, `engineering_task_priority_enum`, `engineering_task_status_enum`
3. Crear tabla `engineering_tasks` con 16 columnas
4. Crear 10 índices (7 simples + 3 compuestos)
5. Foreign Keys con cascade rules:
   - `ticket_id` → tickets (ON DELETE CASCADE)
   - `assigned_to_id` → users (ON DELETE SET NULL)
   - `created_by_id` → users (ON DELETE RESTRICT)

**Estado:** ✅ Aplicada exitosamente en base de datos

---

## 📊 Base de Datos

### Tabla: `engineering_tasks`

```sql
Column              | Type                           | Nullable | Default
--------------------+--------------------------------+----------+---------
id                  | integer                        | NOT NULL | nextval(...)
ticket_id           | integer                        | NULL     | 
title               | varchar(255)                   | NOT NULL | 
description         | text                           | NULL     | 
task_type           | engineering_task_type_enum     | NOT NULL | 
priority            | engineering_task_priority_enum | NOT NULL | 
status              | engineering_task_status_enum   | NOT NULL | 
assigned_to_id      | integer                        | NULL     | 
created_by_id       | integer                        | NOT NULL | 
scheduled_date      | timestamptz                    | NULL     | 
started_at          | timestamptz                    | NULL     | 
completed_at        | timestamptz                    | NULL     | 
resolution_note     | text                           | NULL     | 
rejection_reason    | text                           | NULL     | 
timeline_data       | jsonb                          | NULL     | 
created_at          | timestamptz                    | NOT NULL | now()
updated_at          | timestamptz                    | NOT NULL | now()
```

### Índices Creados:
```
PK: engineering_tasks_pkey (id)
Simple: id, ticket_id, assigned_to_id, created_by_id, task_type, priority, status
Compuestos:
  - (ticket_id, status) - Tareas de un ticket por estado
  - (assigned_to_id, status) - Tareas de un ingeniero por estado
  - (task_type, priority, status) - Dashboard/analytics
```

---

## 🚀 Deployment

**Comandos ejecutados:**
```bash
# 1. Aplicar migración
docker exec emerald_backend alembic upgrade head

# 2. Reiniciar backend
docker restart emerald_backend

# 3. Verificar tabla
docker exec emerald_db psql -U emerald_owner -d emerald_stock -c "\d engineering_tasks"
```

**Estado actual:**
- ✅ Migración aplicada
- ✅ Tabla creada con todos los índices
- ✅ Backend reiniciado sin errores
- ✅ Router registrado en `main.py`

---

## 🔍 Testing Recomendado

### 1. Crear tarea reactiva (desde ticket)
```bash
POST /api/v2/engineering/tasks
{
  "ticket_id": 123,
  "title": "Revisar fibra cortada en Zona Norte",
  "description": "Cliente reporta sin servicio desde 14:00",
  "task_type": "incident",
  "priority": "critical",
  "assigned_to_id": 5
}

# Debe:
# - Crear EngineeringTask
# - Ticket #123 → status: waiting_internal
# - Timeline de ticket: evento "Tarea de ingeniería creada"
```

### 2. Completar tarea
```bash
POST /api/v2/engineering/tasks/1/complete?resolution_note=Fibra reparada. Cliente online.

# Debe:
# - EngineeringTask → status: completed
# - Ticket → status: attention_required
# - Timeline de ticket: evento "✓ Tarea completada"
```

### 3. Crear tarea proactiva (sin ticket)
```bash
POST /api/v2/engineering/tasks
{
  "title": "Mantenimiento preventivo nodo Central",
  "task_type": "maintenance",
  "priority": "medium",
  "scheduled_date": "2026-01-20T09:00:00Z"
}

# Debe:
# - Crear EngineeringTask con ticket_id=NULL
# - NO modificar ningún ticket
```

---

## 📝 Archivos Modificados

### Nuevos Archivos:
- ✅ `backend/src/models/engineering.py` (290 líneas)
- ✅ `backend/src/schemas/engineering.py` (155 líneas)
- ✅ `backend/src/services/engineering_service.py` (425 líneas)
- ✅ `backend/src/routers/engineering.py` (460 líneas)
- ✅ `backend/alembic/versions/j9k0l1m2n3o4p_add_engineering_module.py` (280 líneas)
- ✅ `docs/MODULO_ENGINEERING.md` (este archivo)

### Archivos Modificados:
- ✅ `backend/src/models/tickets.py` - Agregados estados + relación
- ✅ `backend/src/models/__init__.py` - Exportar modelos de engineering
- ✅ `backend/src/main.py` - Registrar router de engineering

---

## 🎯 Próximos Pasos (Sugeridos)

1. **Frontend:**
   - Vista de lista de tareas (filtros por estado, asignado, tipo)
   - Modal de creación de tarea (con selector de ticket opcional)
   - Vista de detalle con timeline_data
   - Dashboard con estadísticas

2. **Testing:**
   - Unit tests para `engineering_service.py` (máquina de estados)
   - Integration tests para API endpoints
   - E2E tests para flujos completos (reactivo/proactivo)

3. **Notificaciones:**
   - WebSocket para actualizar UI cuando cambia estado de tarea
   - Email a ingeniero cuando se le asigna tarea crítica

4. **Autorización:**
   - Rol "engineer" para gestionar tareas
   - Rol "noc_supervisor" para analytics
   - Permisos granulares (quién puede completar/rechazar)

5. **Integraciones:**
   - Slack/Discord webhook cuando tarea crítica sin asignar > 30min
   - Export de estadísticas a CSV/Excel

---

## 🛡️ Filosofía Clean Slate

Este módulo sigue las directrices de Emerald ERP:
- ✅ SQLAlchemy 2.0 exclusivo (`Mapped[]`, `mapped_column()`)
- ✅ PostgreSQL JSONB para datos flexibles (timeline_data)
- ✅ Argon2 para passwords (N/A en este módulo)
- ✅ Documentación técnica en Español
- ✅ Código comentado y con docstrings

---

## 📞 Contacto

Para dudas o mejoras:
- Revisar código en `/opt/emerald-erp/backend/src/`
- Consultar logs: `docker logs emerald_backend`
- Testear con Swagger UI: `http://localhost:8500/docs`

---

**Implementación completada exitosamente** ✨
