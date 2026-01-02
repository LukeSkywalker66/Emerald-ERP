# 🗄️ Arquitectura de Base de Datos

## Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENTES (ISPCube)                         │
├─────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                   │
│ - code (STRING, UNIQUE)          # Código único de cliente      │
│ - name (STRING)                  # Nombre del cliente           │
│ - doc_number (STRING)            # DNI/CUIT                    │
│ - address (STRING)               # Domicilio                    │
│ - status (STRING)                # active/inactive/suspended    │
│ - raw_data (JSONB)               # Datos originales de ISPCube │
│ - created_at (TIMESTAMP)         # Fecha de creación           │
│ - updated_at (TIMESTAMP)         # Última actualización        │
└─────────────────────────────────────────────────────────────────┘
                           1 │ * (1:N)
                             │
                    ┌────────▼─────────┐
                    │  CONNECTIONS     │
                    │  (ISPCube)       │
                    ├──────────────────┤
                    │ PK: id           │
                    │ FK: customer_id  │
                    │ FK: node_id      │
                    │ FK: plan_id      │
                    │ - pppoe_username │
                    │ - direccion      │
                    │ - created_at     │
                    └──────────────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
        ┌───────────▼──────────┐  ┌───▼──────────────────┐
        │   SUBSCRIBERS        │  │  NODES               │
        │ (SmartOLT/Mikrotik)  │  │ (ISPCube/Mikrotik)   │
        ├──────────────────────┤  ├──────────────────────┤
        │ PK: id               │  │ PK: node_id (STR)    │
        │ - unique_external_id │  │ - name               │
        │ - sn (ONU SN)        │  │ - ip_address         │
        │ - olt_name           │  │ - puerto (API)       │
        │ - olt_id             │  │ - created_at         │
        │ - board              │  └──────────────────────┘
        │ - port               │
        │ - onu                │
        │ - onu_type_id        │
        │ - pppoe_username     │
        │ - mode               │
        │ - vlan               │
        └──────────────────────┘

        ┌──────────────────────┐
        │ PPP_SECRETS          │
        │ (Mikrotik)           │
        ├──────────────────────┤
        │ PK: id               │
        │ FK: router_ip        │
        │ - name (username)    │
        │ - password           │
        │ - profile            │
        │ - service            │
        │ - comment            │
        │ - last_caller_id     │
        │ - last_logged_out    │
        │ - created_at         │
        │ - updated_at         │
        └──────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 PLANS (ISPCube)                          │
├──────────────────────────────────────────────────────────┤
│ PK: plan_id (STRING, UNIQUE)                             │
│ - name (STRING)          # Ej: "Plan 50MB"              │
│ - speed (INT)            # Velocidad en Mbps            │
│ - description (TEXT)     # Descripción                   │
│ - created_at (TIMESTAMP) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              SYNC_STATUS (Auditoría)                     │
├──────────────────────────────────────────────────────────┤
│ PK: id                                                   │
│ - fuente (STRING)        # ispcube / mikrotik / smartolt │
│ - estado (STRING)        # success / error / partial     │
│ - detalle (TEXT)         # Mensaje de error o resumen    │
│ - registros_procesados   # Cantidad de filas             │
│ - timestamp (TIMESTAMP)  │
└──────────────────────────────────────────────────────────┘
```

---

## Relaciones Principales

### 1. Cliente → Conexión → Nodo
```
Cliente (ISPCube)
  ↓ tiene
Conexión
  ↓ usa
Node (Router)
```

### 2. Conexión → PPP Secret (Mikrotik)
```
Conexión (pppoe_username)
  ↓ coincide con
PPP_Secret (name)
  ↓ en
Router (router_ip)
```

### 3. Conexión → Subscriber → ONU (SmartOLT)
```
Conexión (pppoe_username)
  ↓ coincide con
Subscriber (pppoe_username)
  ↓ is
ONU (unique_external_id)
```

---

## Índices Críticos (Performance)

```sql
-- Búsqueda rápida por username
CREATE INDEX idx_connections_pppoe 
ON connections(pppoe_username);

-- Búsqueda rápida de secretos
CREATE INDEX idx_ppp_secrets_name 
ON ppp_secrets(name);

-- Búsqueda de suscriptores
CREATE INDEX idx_subscribers_pppoe 
ON subscribers(pppoe_username);

-- Búsqueda por IP de router
CREATE INDEX idx_ppp_secrets_router_ip 
ON ppp_secrets(router_ip);

-- Búsqueda de clientes activos
CREATE INDEX idx_clientes_status 
ON clientes(status) WHERE status = 'active';
```

---

## Migraciones Históricas

Todas las migraciones se encuentran en `backend/alembic/versions/`.

### Versiones Importantes

| ID | Descripción | Fecha |
|----|-------------|-------|
| `221e88a56548` | Creación inicial de tablas | 2025-12-15 |
| `678033205aa3` | Post-stamp de sincronización | 2025-12-20 |

### Agregar una Nueva Migración

```bash
# 1. Modifica backend/src/models.py
# Ejemplo: agregar campo 'priority' a Subscriber

# 2. Generar la migración
docker-compose exec backend alembic revision --autogenerate \
  -m "agregar_priority_a_subscribers"

# 3. Revisar el archivo generado
cat backend/alembic/versions/xxxxx_agregar_priority_a_subscribers.py

# 4. Aplicar la migración
docker-compose exec backend alembic upgrade head
```

---

## Patrones de Consulta Común

### Buscar cliente por PPPoE username
```python
# SQL Puro
SELECT c.* FROM clientes c
JOIN connections conn ON c.id = conn.customer_id
WHERE conn.pppoe_username = 'juan_perez'

# SQLAlchemy
from src import models
from src.database import SessionLocal

db = SessionLocal()
cliente = db.query(models.Cliente)\
  .join(models.Connection)\
  .filter(models.Connection.pppoe_username == 'juan_perez')\
  .first()
```

### Obtener estado completo de una conexión
```python
def get_full_connection_status(pppoe_username: str):
    return {
        "cliente": db.query(models.Cliente)...,
        "conexion": db.query(models.Connection)...,
        "nodo": db.query(models.Node)...,
        "ppp_secret": db.query(models.PPPSecret)...,
        "subscriber": db.query(models.Subscriber)...,
    }
```

---

## Backup y Recovery

### Hacer backup de PostgreSQL
```bash
# Backup completo
docker-compose exec db pg_dump \
  -U ${POSTGRES_USER} ${POSTGRES_DB} > backup.sql

# Backup con compresión
docker-compose exec db pg_dump \
  -U ${POSTGRES_USER} -Fc ${POSTGRES_DB} > backup.dump
```

### Restaurar desde backup
```bash
# Desde archivo SQL
docker-compose exec -T db psql \
  -U ${POSTGRES_USER} ${POSTGRES_DB} < backup.sql

# Desde archivo comprimido
docker-compose exec -T db pg_restore \
  -U ${POSTGRES_USER} -d ${POSTGRES_DB} backup.dump
```

---

## Optimizaciones y Caché

### Datos que cambian frecuentemente
- **PPP Secrets** (estado de conexión) → Sin caché
- **ONU Signals** (señales ópticas) → Caché 5 minutos

### Datos que cambian raramente
- **Clientes** → Caché 24 horas
- **Planes** → Caché 24 horas
- **Nodos** → Caché 12 horas

### Implementar caché con Redis
```python
from src import config
import redis
import json

cache = redis.Redis(host='redis', port=6379, db=0)

def get_cliente_cached(cliente_id):
    key = f"cliente:{cliente_id}"
    cached = cache.get(key)
    if cached:
        return json.loads(cached)
    
    # Consultar BD
    cliente = db.query(models.Cliente).get(cliente_id)
    
    # Guardar en caché 24h
    cache.setex(key, 86400, json.dumps(cliente.to_dict()))
    return cliente
```

---

## Monitoreo de BD

### Conexiones activas
```bash
docker-compose exec db psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

### Tamaño de la BD
```bash
docker-compose exec db psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('emerald'));"
```

### Índices no utilizados
```bash
docker-compose exec db psql -U postgres -d emerald -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes 
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY tablename, indexname;"
```

---

## 🎫 Sistema de Tickets v2.0 (NUEVO - 02/01/2026)

### Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────┐
│                    TICKETS_V2                              │
├─────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                               │
│ - ticket_code (STRING, UNIQUE)  # CNX-XXXX                │
│ - title (STRING)                # Título del ticket        │
│ - description (TEXT)            # Descripción               │
│ - status (ENUM)                 # OPEN/IN_PROGRESS/CLOSED │
│ - priority (ENUM)               # LOW/MEDIUM/HIGH/CRITICAL │
│ - assigned_to_id (UUID, FK)     # Técnico asignado        │
│ - creator_id (UUID, FK)         # Operador que creó       │
│ - created_at (TIMESTAMP)        │
│ - updated_at (TIMESTAMP)        │
└─────────────────────────────────────────────────────────────┘
                         1 │ *
                           │
            ┌──────────────┴──────────────┐
            │                             │
    ┌───────▼──────────────┐   ┌────────▼──────────────┐
    │  TICKET_TIMELINE     │   │   WORK_ORDERS        │
    │ (Bitácora de Eventos)│   │ (Órdenes de Trabajo) │
    ├──────────────────────┤   ├─────────────────────┤
    │ PK: id               │   │ PK: id              │
    │ FK: ticket_id ◄──────┤   │ FK: ticket_id ◄─────┤
    │ FK: author_id        │   │ FK: technician_id   │
    │ - event_type (ENUM)  │   │ - ot_type (ENUM)    │
    │ - content (TEXT)     │   │ - status (ENUM)     │
    │ - meta_data (JSONB)  │   │ - scheduled_date    │
    │ - created_at         │   │ - completed_at      │
    │                      │   │ - total_duration    │
    │                      │   │ - created_at        │
    │                      │   └─────────────────────┘
    │                      │           │
    │                      │           │ *
    │                      │    ┌──────▼─────────────┐
    │                      │    │  WORK_ORDER_ITEMS  │
    │                      │    │ (Materiales usados)│
    │                      │    ├────────────────────┤
    │                      │    │ PK: id             │
    │                      │    │ FK: work_order_id  │
    │                      │    │ - product_id (SOFT)│
    │                      │    │ - serial_number    │
    │                      │    │ - quantity         │
    │                      │    │ - consumed_at      │
    │                      │    └────────────────────┘
    │                      │
    └──────────────────────┘

FK: creator_id, assigned_to_id → users.id
FK: ticket_id → tickets_v2.id (CASCADE)
FK: technician_id → users.id (SET NULL)
FK: work_order_id → work_orders.id (CASCADE)
```

### Enums del Sistema de Tickets

**TicketStatus:**
```python
class TicketStatus(str, Enum):
    OPEN = "open"                    # Recién creado
    IN_PROGRESS = "in_progress"      # Técnico asignado
    WAITING_CUSTOMER = "waiting"     # Esperando cliente
    CLOSED = "closed"                # Resuelto
```

**TicketPriority:**
```python
class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
```

**TicketTimelineEventType:**
```python
class TicketTimelineEventType(str, Enum):
    NOTE = "note"                    # Nota manual del operador
    STATUS_CHANGE = "status_change"  # Cambio de estado
    ASSIGNMENT = "assignment"        # Asignación a técnico
    OT_CREATED = "ot_created"       # Orden de trabajo creada
    OT_COMPLETED = "ot_completed"   # Orden completada
    TELEMETRY_ALERT = "telemetry"  # Alerta de telemetría
    CUSTOMER_CONTACTED = "contact"  # Contacto con cliente
    CLOSED = "closed"                # Ticket cerrado
```

**WorkOrderStatus:**
```python
class WorkOrderStatus(str, Enum):
    PENDING_PLANNING = "pending_planning"  # Pendiente de planificar
    SCHEDULED = "scheduled"                # Programada
    IN_PROGRESS = "in_progress"           # En ejecución
    COMPLETED = "completed"                # Completada
    CANCELLED = "cancelled"                # Cancelada
```

**WorkOrderType:**
```python
class WorkOrderType(str, Enum):
    DIAGNOSIS = "diagnosis"          # Diagnóstico
    REPAIR = "repair"                # Reparación
    INSTALL = "install"              # Instalación
    UPGRADE = "upgrade"              # Upgrade de equipos
    MAINTENANCE = "maintenance"      # Mantenimiento preventivo
```

### Índices y Performance

```sql
-- Búsqueda rápida por código de ticket
CREATE INDEX idx_tickets_v2_code ON tickets_v2(ticket_code);

-- Búsqueda por estado
CREATE INDEX idx_tickets_v2_status ON tickets_v2(status);

-- Búsqueda por prioridad
CREATE INDEX idx_tickets_v2_priority ON tickets_v2(priority);

-- Búsqueda por técnico asignado
CREATE INDEX idx_tickets_v2_assigned ON tickets_v2(assigned_to_id);

-- Búsqueda en timeline por ticket
CREATE INDEX idx_timeline_ticket ON ticket_timeline(ticket_id);

-- Búsqueda en timeline por tipo de evento
CREATE INDEX idx_timeline_event_type ON ticket_timeline(event_type);

-- Búsqueda de OT por ticket
CREATE INDEX idx_work_orders_ticket ON work_orders(ticket_id);

-- Búsqueda de OT por técnico
CREATE INDEX idx_work_orders_technician ON work_orders(technician_id);

-- Búsqueda de items por OT
CREATE INDEX idx_work_order_items_ot ON work_order_items(work_order_id);

-- Búsqueda de items por serial (trazabilidad)
CREATE INDEX idx_work_order_items_serial ON work_order_items(serial_number);
```

### Relaciones y Constraints

| Relación | Tipo | Comportamiento |
|----------|------|----------------|
| ticket → creator (users.id) | FK | Requerido (NOT NULL) |
| ticket → assigned_to (users.id) | FK | Opcional (asignación dinámica) |
| ticket_timeline → ticket | FK | Requerido + **CASCADE DELETE** |
| ticket_timeline → author (users.id) | FK | Optional + **SET NULL** (autor puede borrarse) |
| work_order → ticket | FK | Requerido + **CASCADE DELETE** |
| work_order → technician (users.id) | FK | Optional + **SET NULL** |
| work_order_item → work_order | FK | Requerido + **CASCADE DELETE** |
| work_order_item → product_id | SOFT FK | Sin constraint (flexible para futuros cambios) |

### Campos JSONB (meta_data en ticket_timeline)

**Propósito:** Almacenar datos variables según event_type sin cambios de schema.

**Ejemplos por tipo de evento:**

```python
# NOTE: Simple
{
  "message": "Cliente confirma disponibilidad el viernes"
}

# STATUS_CHANGE: Con contexto
{
  "from_status": "open",
  "to_status": "in_progress",
  "reason": "Asignado a Técnico"
}

# OT_CREATED: Snapshot de OT
{
  "work_order_id": "550e8400-e29b-41d4-a716-446655440000",
  "ot_type": "diagnosis",
  "scheduled_date": "2026-01-04T10:00:00Z",
  "technician": "Juan Técnico"
}

# TELEMETRY_ALERT: Datos de ONU
{
  "onu_sn": "GPON12AB34CD56",
  "signal_dbm": -25,
  "onu_status": "online",
  "infraestructura": "PON-ZONA-3",
  "threshold_exceeded": "signal_critical"
}

# CUSTOMER_CONTACTED: Log de contacto
{
  "contact_method": "phone",
  "contact_date": "2026-01-03T15:30:00Z",
  "response": "Cliente disponible el 04/01"
}
```

### Migración SQL (Alembic)

**Archivo:** `backend/alembic/versions/8bc58d283e34_crear_tablas_tickets_work_orders.py`  
**Creada:** 02/01/2026  
**Status:** ✅ Ejecutada exitosamente

**Cambios aplicados:**
```
1. CREATE TABLE tickets_v2 (10 columnas, 5 índices, 2 FKs)
2. CREATE TABLE ticket_timeline (8 columnas, 3 índices, 2 FKs, JSONB meta_data)
3. CREATE TABLE work_orders (10 columnas, 4 índices, 2 FKs)
4. CREATE TABLE work_order_items (8 columnas, 3 índices, 1 FK)
5. CREATE ENUMS: TicketStatus, TicketPriority, TicketTimelineEventType, WorkOrderStatus, WorkOrderType
```

**Reversi:** `alembic downgrade 324f44f48d0a` (vuelve a migración anterior)

### Verificación Post-Migración

```bash
# Listar todas las tablas de tickets
docker-compose exec -T backend python -c "
from src.database.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = [t for t in sorted(inspector.get_table_names()) 
          if 'ticket' in t.lower() or 'work_order' in t.lower()]
for t in tables:
    print(f'✓ {t}')
"

# Resultado esperado:
# ✓ ticket_categories
# ✓ ticket_events
# ✓ ticket_timeline
# ✓ tickets
# ✓ tickets_v2
# ✓ work_order_items
# ✓ work_orders
```

