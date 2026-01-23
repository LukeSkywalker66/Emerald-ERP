# 🎫 Arquitectura - Tickets

> **Nota Historical (Actualizado 08/01/2026):** La tabla principal ahora se llama `tickets` (antes `tickets_v2`). La tabla legacy se renombró a `tickets_legacy` para preservar datos antiguos. Ver [#RENAME-TICKETS-V2](./ARQUITECTURA_TICKETS_V2.md#rename-tickets-v2).

## 📋 Contexto & Decisiones Arquitectónicas

**Pregunta Base:** ¿Cómo almacenamos y servimos datos de tickets de forma profesional, portable y mantenible?

**Enfoque:** Database-centric. Los datos viven en PostgreSQL, los ORM/Schemas proporcionan validación y transformación.

---

## 1️⃣ Modelo de Datos - Estructura de Tablas

### 1.1 Tabla Base: `tickets` (antes `tickets_v2`)

```sql
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER,  -- FK WEAK: conexión es "casi" obligatoria pero nullable
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(8) NOT NULL,        -- ENUM: open, in_progress, pending, closed
    priority VARCHAR(8) NOT NULL,      -- ENUM: low, medium, high, critical
    creator_id INTEGER NOT NULL,       -- FK -> users.id
    assigned_to_id INTEGER,            -- FK -> users.id (nullable)
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

  CREATE INDEX ix_tickets_connection_id ON tickets(connection_id);
  CREATE INDEX ix_tickets_status ON tickets(status);
  CREATE INDEX ix_tickets_priority ON tickets(priority);
  CREATE INDEX ix_tickets_created_at ON tickets(created_at DESC);
```

**Rationale:**
- ✅ Connection es link débil (nullable) porque un ticket puede ser sobre infraestructura general
- ✅ Status + Priority indexados para búsquedas rápidas
- ✅ creator_id + assigned_to_id para rastrear responsabilidades
- ✅ timestamps para auditoría

### 1.2 Tabla Timeline: `ticket_timeline`

```sql
CREATE TABLE ticket_timeline (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(13) NOT NULL,   -- ENUM: note, alert, ot_event, status_change
    content TEXT NOT NULL,              -- Narrativa del evento
    meta_data JSONB,                    -- Datos estructurados adicionales
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX ix_ticket_timeline_ticket_id ON ticket_timeline(ticket_id);
CREATE INDEX ix_ticket_timeline_event_type ON ticket_timeline(event_type);
CREATE INDEX ix_ticket_timeline_created_at ON ticket_timeline(created_at DESC);
CREATE INDEX ix_ticket_timeline_ticket_created ON ticket_timeline(ticket_id, created_at DESC);
```

**Rationale:**
- ✅ Inmutable por defecto (no editamos eventos pasados)
- ✅ CASCADE delete: al eliminar ticket se eliminan todos los eventos
- ✅ JSONB para metadata flexible (ej: old_value, new_value en STATUS_CHANGE)
- ✅ Índice compound (ticket_id, created_at) para queries típicas

### 1.3 Tabla WorkOrders: `work_orders`

```sql
CREATE TABLE work_orders (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    ot_type VARCHAR(20) NOT NULL,              -- ENUM: repair, install, pickup, infrastructure
    status VARCHAR(20) NOT NULL,               -- ENUM: pending_planning, assigned, in_progress, completed, failed
    technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    resolution_type VARCHAR(15),               -- ENUM: success, failed, rescheduled, partial
    resolution_notes TEXT,                     -- Narrativa del técnico (≥10 caracteres)
    resolution_category VARCHAR(14),           -- ENUM: infrastructure, equipment, configuration, other
    photo_urls JSONB DEFAULT '[]',             -- Array de URLs de fotos de evidencia
    custom_data JSONB,                         -- Datos flexibles del técnico (speeds, signals, etc)
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX ix_work_orders_ticket_id ON work_orders(ticket_id);
CREATE INDEX ix_work_orders_status ON work_orders(status);
CREATE INDEX ix_work_orders_technician_id ON work_orders(technician_id);
CREATE INDEX ix_work_orders_completed_at ON work_orders(completed_at);
```

**Nuevos Campos (8 de enero 2026):**
- ✅ `resolution_category` (VARCHAR 14): Categoriza la resolución (infraestructura, equipamiento, configuración, otra)
- ✅ `photo_urls` (JSONB): Array de strings con URLs de fotos de evidencia
- ✅ `started_at`: Marca cuándo el técnico comienza el trabajo en sitio
- ✅ `completed_at`: Marca cuándo se finaliza la OT
- ✅ `resolution_type`: Tipo de resolución (éxito, fallo, reprogramado, parcial)
- ✅ `resolution_notes`: Narrativa flexible del técnico sobre qué se hizo

**Rationale:**
- ✅ `completed_at` permite filtrar OTs finalizadas vs. en progreso
- ✅ `resolution_category` facilita reportes por tipo de resolución
- ✅ `photo_urls` (JSONB) almacena evidencia sin schema rígido
- ✅ `resolution_notes` es libre-formato para narrativa del técnico (min 10 caracteres)
- ✅ `custom_data` flexibiliza datos variables (speedtest, señal óptica, etc)

### 1.4 Tabla Motivos: `ticket_reasons` + FK opcional en `tickets`

```sql
CREATE TABLE ticket_reasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES ticket_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ix_ticket_reasons_id ON ticket_reasons(id);
CREATE INDEX ix_ticket_reasons_category_id ON ticket_reasons(category_id);

-- tickets: FK opcional (permite tickets creados antes de la feature)
ALTER TABLE tickets
  ADD COLUMN ticket_reason_id INTEGER NULL,
  ADD CONSTRAINT fk_tickets_reason_id FOREIGN KEY (ticket_reason_id)
    REFERENCES ticket_reasons(id) ON DELETE SET NULL;
CREATE INDEX ix_tickets_ticket_reason_id ON tickets(ticket_reason_id);
```

**Rationale:**
- ✅ Motivo depende de la categoría (FK obligatoria, cascade delete)
- ✅ FK en `tickets` es opcional para compatibilidad hacia atrás
- ✅ Índices para filtrar rápido por categoría y motivo
- ✅ Timestamps para auditoría

**Seeds iniciales (enero 2026):**
- `Falla Técnica`: Sin Servicio, Intermitencia/Microcortes, Lentitud, Problema WiFi
- `Administrativo`: Cambio de Plan/Servicio, Cambio de Titularidad, Facturación
- `Traslado`: Traslado Interno, Traslado a otro domicilio
- `Baja`: Precio/Competencia, Disconformidad Técnica, Mudanza, Fallecimiento
- `Instalación`: sin motivos (no aplica)

**API:**
- `GET /api/v2/tickets/reasons?category_id={id?}` devuelve motivos; sin filtro retorna todos.
- Validación en `POST /api/v2/tickets`: si se envía `ticket_reason_id` debe pertenecer a la `category_id` del ticket.

---

## 2️⃣ Enriquecimiento de Datos - Conexión + Cliente

### 2.1 El Problema

Cuando solicitamos un ticket, necesitamos:
- **Dirección:** ¿De la conexión o del cliente?
- **Teléfono:** ¿Dónde está?
- **Plan:** ¿Cuál es el plan actual?
- **Nodo:** ¿A qué nodo pertenece?

### 2.2 Solución: JOIN en el Endpoint

**Filosofía:** El backend es responsable de normalizar datos.

```sql
-- En GET /api/v2/tickets/{id} generamos esta query:
SELECT 
    c.connection_id,
    c.pppoe_username,
    COALESCE(c.direccion, cl.address) as address,  -- Fallback: si conexión no tiene, usa cliente
    cl.name as client_name,
    cl.doc_number as client_dni,
    n.name as node_name,
    n.ip_address as node_ip,
    p.name as plan_name,
    p.speed as plan_speed,
    NULL::text as phone  -- TODO: agregar teléfono cuando esté disponible
FROM connections c
LEFT JOIN clientes cl ON c.customer_id = cl.id
LEFT JOIN nodes n ON c.node_id = n.node_id
LEFT JOIN plans p ON c.plan_id = p.plan_id
WHERE c.connection_id = :conn_id;
```

**Rationale:**
- ✅ Raw SQL con `text()` porque las tablas legadas no tienen ORM
- ✅ LEFT JOIN preserva tickets sin conexión
- ✅ COALESCE normaliza dirección (prioridad: conexión > cliente)
- ✅ Una sola query sin N+1 problem

### 2.3 Schema Pydantic: `ConnectionDetailsResponse`

```python
class ConnectionDetailsResponse(BaseModel):
    """Datos enriquecidos de la conexión asociada al ticket."""
    connection_id: Optional[int] = None
    pppoe_username: Optional[str] = None
    address: Optional[str] = None              # Dirección normalizada
    phone: Optional[str] = None                # TODO: agregar
    client_name: Optional[str] = None
    client_dni: Optional[str] = None
    node_name: Optional[str] = None
    node_ip: Optional[str] = None
    plan_name: Optional[str] = None
    plan_speed: Optional[int] = None
```

**Rationale:**
- ✅ Schema-driven: Pydantic valida antes de serializar
- ✅ Opcionales: Sobrevive a datos faltantes
- ✅ Strongly-typed: Client sabe exactamente qué esperar
- ✅ Versionable: Futura API v3 puede modificar sin impactar v2

### 2.4 Endpoint: `GET /api/v2/tickets/{id}`

```json
{
  "id": 10,
  "subject": "Velocidad baja",
  "status": "open",
  "priority": "high",
  "connection_id": 17065,
  "created_at": "2026-01-05T12:09:21.599142Z",
  "creator_name": "Administrador",
  "assigned_to_name": "Operador 1",
  
  // 🆕 Datos enriquecidos
  "connection_details": {
    "connection_id": 17065,
    "pppoe_username": "gabenega",
    "address": "Medardo Ulloque sn",
    "client_name": "BANEGA GLORIA",
    "client_dni": "16514540",
    "node_name": "nodo(San Jose)",
    "node_ip": "138.59.175.11",
    "plan_name": "100Mb (San Jose)",
    "plan_speed": null,
    "phone": null
  },
  
  "timeline": [...],
  "work_orders": [...]
}
```

---

## 3️⃣ Timeline - Auditoría Inmutable

### 3.1 Eventos Soportados

| Tipo | Ejemplo | metadata |
|------|---------|----------|
| `note` | "Revisar configuración PPPoE" | - |
| `alert` | "ONU desconectada" | `{alert_level: "critical"}` |
| `status_change` | "Estado: open → in_progress" | `{old: "open", new: "in_progress"}` |
| `ot_event` | "OT #42 asignada a Técnico Juan" | `{work_order_id: 42}` |

### 3.2 Ejemplo: Flujo de Edición Inline

```
Usuario cambia status "open" → "in_progress"
  ↓
PATCH /api/v2/tickets/10
  { status: "in_progress" }
  ↓
Backend:
  1. Detecta cambio: old="open", new="in_progress"
  2. Actualiza tickets_v2.status
  3. Inserta en ticket_timeline:
     {
       ticket_id: 10,
       author_id: 2 (usuario logeado),
       event_type: "status_change",
       content: "Estado cambiado de open a in_progress",
       meta_data: {old: "open", new: "in_progress"}
     }
  4. Retorna TicketResponse actualizado
  ↓
Frontend:
  - UI actualiza estado
  - Recarga ticket completo via GET
  - Timeline muestra nuevo evento
```

### 3.3 Por Qué Esto es Profesional

✅ **Auditoría completa:** Sabemos QUÉ cambió, QUIÉN lo cambió, CUÁNDO
✅ **No-borrable:** Events son append-only. Imposible ocultar historial
✅ **Portable:** Si migramos a otra BD, los eventos viajan con el ticket
✅ **Escalable:** 1000 eventos por ticket = 8-16KB comprimido
✅ **Queryable:** Podemos buscar "todos los tickets que Juan tocó"

---

## 4️⃣ Validación - Schemas Pydantic

### 4.1 Crear Ticket: `TicketCreate`

```python
class TicketCreate(BaseModel):
    subject: str                         # Obligatorio
    description: Optional[str] = None
    priority: TicketPriority = MEDIUM   # Enums validados
    connection_id: Optional[int] = None
```

**Validaciones:**
- Subject: min 3 caracteres (en frontend)
- Priority: solo valores del enum
- Description: si viene, min 5 caracteres

### 4.2 Actualizar Ticket: `TicketUpdate`

```python
class TicketUpdate(BaseModel):
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_to_id: Optional[int] = None
```

**Filosofía:** Partial update. Solo los campos que manda el cliente.

```python
# Backend valida cambios reales
if payload.status and payload.status != ticket.status:
    # genera timeline event
```

### 4.3 Agregar Nota: `TimelineEventCreate`

```python
class TimelineEventCreate(BaseModel):
    content: str = Field(..., min_length=1)
    event_type: TicketTimelineEventType = TicketTimelineEventType.NOTE
```

**Validación en action:**
```
Cliente envía: { "content": "  ", "event_type": "note" }
Pydantic rechaza: "ensure this value has at least 1 character"
Status 422 Unprocessable Entity
```

---

## 5️⃣ Endpoints API - Contract Completo

### 5.1 Listar Tickets

```
GET /api/v2/tickets?status=open&priority=high&limit=50&offset=0

Response: Array[TicketResponse]
```

### 5.2 Crear Ticket

```
POST /api/v2/tickets
Content-Type: application/json

{
  "subject": "Velocidad baja",
  "description": "Cliente reporta 10Mbps en lugar de 50Mbps",
  "priority": "high",
  "connection_id": 17065
}

Response: TicketResponse (201 Created)
```

### 5.3 Obtener Detalle

```
GET /api/v2/tickets/10

Response: TicketDetailResponse {
  ...ticket fields...,
  connection_details: ConnectionDetailsResponse,
  timeline: Array[TimelineEventResponse],
  work_orders: Array[WorkOrderResponse]
}
```

### 5.4 Actualizar Ticket (Inline Edit)

```
PATCH /api/v2/tickets/10
Content-Type: application/json

{
  "status": "in_progress",
  "assigned_to_id": 8
}

Response: TicketResponse (actualizado)
+ Crea evento en timeline automáticamente
```

### 5.5 Agregar Nota

```
POST /api/v2/tickets/10/timeline
Content-Type: application/json

{
  "content": "Cliente no atiende, reprogramar para mañana",
  "event_type": "note"
}

Response: TimelineEventResponse (201 Created)
```

### 5.6 Solicitar Visita (Crear OT)

```
POST /api/v2/tickets/10/work-orders
Content-Type: application/json

{
  "ot_type": "repair",
  "notes": "Técnico debe revisar ONU e instalación"
}

Response: WorkOrderResponse (201 Created)
+ Crea evento OT_EVENT en timeline
```

---

## 6️⃣ Frontend Integration

### 6.1 Service Layer

```javascript
// src/services/tickets.service.js

export const getById = async (id) => {
  const { data } = await api.get(`/v2/tickets/${id}`);
  return data;  // TicketDetailResponse con connection_details
};

export const updateTicket = async (id, payload) => {
  const { data } = await api.patch(`/v2/tickets/${id}`, payload);
  return data;  // TicketResponse actualizado
};

export const addNote = async (ticketId, content) => {
  const { data } = await api.post(`/v2/tickets/${ticketId}/timeline`, {
    content,
    event_type: 'note',  // MINÚSCULAS: es un enum del backend
  });
  return data;
};
```

### 6.2 Componentes React

```jsx
// TicketDetailPage.jsx

// Mostrar datos de conexión enriquecidos
{ticket.connection_details && (
  <div className="connection-info">
    <p>Cliente: {ticket.connection_details.client_name}</p>
    <p>Dirección: {ticket.connection_details.address}</p>
    <p>Nodo: {ticket.connection_details.node_name}</p>
    <p>Plan: {ticket.connection_details.plan_name}</p>
  </div>
)}

// Edición inline
<EditableField
  value={ticket.status}
  options={[{value: 'open', label: 'Abierto'}, ...]}
  onSave={async (newVal) => {
    await updateTicket(ticket.id, {status: newVal});
  }}
/>

// Agregar nota
<textarea 
  value={noteContent}
  onChange={e => setNoteContent(e.target.value)}
/>
<button onClick={async () => {
  await addNote(ticket.id, noteContent);
  setNoteContent('');
  // Recargar ticket para ver timeline actualizado
}}>
  Enviar
</button>
```

---

## 7️⃣ Testing Checklist

### 7.1 Backend

```bash
# Crear ticket
curl -X POST http://localhost:8500/api/v2/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test",
    "priority": "high",
    "connection_id": 17065
  }'

# Obtener detalle (con connection_details)
curl http://localhost:8500/api/v2/tickets/10

# Actualizar (genera timeline event)
curl -X PATCH http://localhost:8500/api/v2/tickets/10 \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# Agregar nota
curl -X POST http://localhost:8500/api/v2/tickets/10/timeline \
  -H "Content-Type: application/json" \
  -d '{"content": "Test", "event_type": "note"}'

# Solicitar visita
curl -X POST http://localhost:8500/api/v2/tickets/10/work-orders \
  -H "Content-Type: application/json" \
  -d '{"ot_type": "repair"}'
```

### 7.2 Frontend

- [ ] Abrir ticket → Ver connection_details en sidebar
- [ ] Click en dropdown status → Cambiar a otro → Ver timeline event
- [ ] Escribir nota → Click enviar → Aparece en timeline
- [ ] Solicitar visita → Modal → Se crea OT → Aparece en work_orders

---

## 8️⃣ Decisiones de Diseño Explicadas

### ¿Por qué Raw SQL para connection_details?

❌ **Opción 1:** ORM con relationships
```python
ticket.connection.client.name  # N+1 queries!
```
❌ 3 queries: ticket, connection, client

✅ **Opción 2 (Elegida):** Raw SQL con JOIN
```python
# Una sola query, datos ya enriquecidos
```
✅ 1 query

### ¿Por qué JSONB en meta_data?

❌ **Opción 1:** Columnas fijas
```sql
ALTER TABLE ticket_timeline ADD COLUMN old_status VARCHAR(8);
ALTER TABLE ticket_timeline ADD COLUMN old_priority VARCHAR(8);
-- Explosion de columnas
```

✅ **Opción 2 (Elegida):** JSONB flexible
```sql
meta_data: {
  "old_status": "open",
  "new_status": "in_progress",
  "old_assigned": null,
  "new_assigned": 8
}
-- Escalable, queryable, versionable
```

### ¿Por qué Pydantic schemas?

Protege la API:
```
Cliente envía: { "status": "invalid_status" }
Pydantic rechaza antes de tocar la BD
Status 422 con error descriptivo
```

---

## 8️⃣ Flujo de Cierre de Orden de Trabajo (Nuevo - 8 de enero 2026)

### Contexto
El técnico completa una OT en sitio. Necesita:
1. Categorizar la resolución (infraestructura/equipamiento/configuración/otra)
2. Describir qué se hizo (narrativa >10 caracteres)
3. Registrar materiales consumidos
4. Adjuntar fotos como evidencia

### Flujo en Backend

**PATCH /v2/work-orders/{id}**

```python
# Payload
{
  "status": "completed",
  "completed_at": "2026-01-08T11:29:54Z",
  "resolution_category": "infrastructure",      # enum: infrastructure|equipment|configuration|other
  "resolution_notes": "Se reemplazó fibra cortada...",  # min_length=10, max=1000
  "photo_urls": [                               # JSONB array de strings
    "/media/tickets/20/photo1.jpg",
    "/media/tickets/20/photo2.jpg"
  ]
}
```

**Backend Processing:**
1. Valida payload con `WorkOrderUpdate` schema (Pydantic)
2. Aplica `flag_modified()` para campos JSONB
3. Persiste en `work_orders` table
4. Crea evento en `ticket_timeline` con metadata de resolución
5. Devuelve `WorkOrderDetailResponse` con todos los datos

**GET /v2/work-orders/{id}**

```python
# Response includes:
{
  "id": 12,
  "status": "completed",
  "completed_at": "2026-01-08T11:29:54Z",
  "resolution_category": "infrastructure",
  "resolution_notes": "Se reemplazó fibra cortada...",
  "photo_urls": ["/media/tickets/20/photo1.jpg", "/media/tickets/20/photo2.jpg"],
  "items": [...],                               # Materiales utilizados
  "ticket_info": {...}
}
```

### Flujo en Frontend

**Wizard de 3 pasos** (`CloseWorkOrderDialog.jsx`):

1. **Paso 1 - Resolución:**
   - Select de 4 categorías (radio buttons estilo neon)
   - Textarea para narrativa (validación en tiempo real: 10-1000 chars)

2. **Paso 2 - Materiales:**
   - Listado de materiales consumidos (desde `workOrder.items`)
   - Advertencia si instalación sin materiales
   - Formulario optional para agregar material manual

3. **Paso 3 - Evidencia:**
   - Botón "Explorar archivo" (file picker)
   - Botón "Abrir cámara" (capture)
   - Compresión client-side: imágenes >2MB → JPEG quality 0.82, max 1600px
   - Upload a `/v2/tickets/{ticket_id}/attachments` con JWT
   - Galería con miniaturas + botón eliminar

**Validaciones:**
- Categoría: obligatoria (select)
- Notas: 10-1000 caracteres
- Fotos: obligatoria si `ot_type` ∈ {repair, install} (opcional si pickup)

**Resumen Post-Completación** (`WorkOrderCompletedSummary.jsx`):
- Badge de categoría (colores: blue/purple/emerald/amber)
- Descripción del trabajo
- Materiales consumidos
- Galería de fotos (2-3 cols, hover overlay "Ver")
- Link al ticket origen con `navigate()`

---

## 🔄 #RENAME-TICKETS-V2

**Decisión (Ejecutada 08/01/2026):** Renombrar tabla `tickets_v2` → `tickets` y estacionar la tabla legacy como `tickets_legacy`.

**Contexto:** La tabla `tickets` original era demo/legacy y generaba confusión. El código productivo usa el modelo nuevo.

**Impacto (completado):**
- Migration Alembic: rename table + renombrar índices `_v2` → estándar (hecho)
- Model: `class Ticket` actualiza `__tablename__ = "tickets"` (hecho)
- Routers: import renombrado a `tickets` (hecho)
- Tests/Referencias: se deben actualizar si usan el nombre antiguo

**Prioridad:** COMPLETADO (08/01/2026)

---

## 9️⃣ Roadmap Futuro

- [ ] Agregar teléfono del cliente a connection_details
- [x] Renombrar `tickets_v2` → `tickets` (cleanup nomenclatura) — 08/01/2026
- [ ] Soporte para SLAs (tiempo máximo de respuesta)
- [ ] Búsqueda full-text en timeline (PostgreSQL `tsvector`)
- [ ] Notificaciones automáticas (cuando status cambia)
- [ ] Reportes: "Top issues por nodo"
- [ ] Exportar timeline a PDF

---

## 🔟 Resumen

| Aspecto | Decisión |
|---------|----------|
| **Base de datos** | PostgreSQL con 3 tablas (tickets, timeline, work_orders) |
| **Enriquecimiento** | Raw SQL JOINs (eficiente, portable) |
| **Validación** | Pydantic BaseModel (strongly-typed) |
| **Auditoría** | Timeline inmutable append-only |
| **API** | RESTful con versioning (/v2) |
| **Frontend** | React + Service Layer + EditableFields |

✅ **Profesional:** Auditoría completa, versionada
✅ **Portable:** Funciona en cualquier PostgreSQL
✅ **Mantenible:** Clear separation of concerns
