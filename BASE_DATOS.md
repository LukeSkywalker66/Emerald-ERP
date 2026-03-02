# 🗄️ Arquitectura de Base de Datos - Emerald ERP

**Última actualización:** 2 de marzo de 2026  
**Stack:** PostgreSQL 15 Alpine + SQLAlchemy 2.0 + Alembic  
**Patrón:** Clean Slate (Mapped[], mapped_column(), JSONB flexible)

---

## 📐 Diagrama de Entidades Integral

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔐 USUARIOS Y AUTENTICACIÓN                                    │
├─────────────────────────────────────────────────────────────────┤
│ USERS                           │ ROLES                         │
│ ├─ id (INT PK)                  │ ├─ id (INT PK)               │
│ ├─ email (VARCHAR UNIQUE)       │ ├─ name (VARCHAR UNIQUE)     │
│ ├─ hashed_password (VARCHAR)    │ ├─ description (TEXT)        │
│ ├─ role_id (FK→roles)           │ └─ permissions (JSONB)       │
│ ├─ first_name (VARCHAR)         │                              │
│ ├─ last_name (VARCHAR)          │ USER_ROLES (M2M)            │
│ ├─ is_active (BOOL)             │ ├─ user_id (FK→users)       │
│ ├─ team_memberships (REL)       │ └─ role_id (FK→roles)       │
│ └─ created_at, updated_at       │                              │
└─────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────────┐
│ 🚗 COORDINACIÓN Y CUADRILLAS (NUEVO - 02/02/2026)              │
├─────────────────────────────────────────────────────────────────┤
│ TEAMS (Cuadrillas)         │ TEAM_MEMBERS (Asociación)         │
│ ├─ id (INT PK)             │ ├─ id (INT PK)                     │
│ ├─ name (VARCHAR UNIQUE)   │ ├─ team_id (FK→teams) CASCADE     │
│ ├─ vehicle_id (INT)        │ ├─ user_id (FK→users) CASCADE     │
│ ├─ is_active (BOOL)        │ ├─ role (ENUM: leader/tech)       │
│ ├─ members (REL)           │ ├─ UC: (team_id, user_id)         │
│ ├─ work_orders (REL)       │ └─ created_at, updated_at         │
│ └─ created_at, updated_at  │                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🚛 FLOTA Y LOGÍSTICA (NUEVO - 03/02/2026)                     │
├─────────────────────────────────────────────────────────────────┤
│ VEHICLES (Activos físicos)    │ WAREHOUSES (Inventario)        │
│ ├─ id (INT PK)                │ ├─ id (INT PK)                 │
│ ├─ name (VARCHAR)             │ ├─ name (VARCHAR)              │
│ ├─ license_plate (VARCHAR UQ) │ ├─ type (ENUM: CENTRAL,        │
│ ├─ vehicle_brand (VARCHAR)    │ │        MOBILE, VIRTUAL)      │
│ ├─ vehicle_model (VARCHAR)    │ ├─ vehicle (REL bidireccional)│
│ ├─ vehicle_year (INT)         │ ├─ stock_bulk (REL)            │
│ ├─ status (ENUM: ACTIVE,      │ ├─ serial_items (REL)         │
│ │        MAINTENANCE,          │ └─ created_at, updated_at     │
│ │        RETIRED,              │                               │
│ │        DONATED)              │ (1:1 Vehicle→Warehouse MOBILE)│
│ ├─ warehouse_id (FK→warehouses)│                               │
│ ├─ team (REL opt: Team)       │                               │
│ └─ created_at, updated_at     │                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🎫 SISTEMA DE TICKETS (Core 2.0)                              │
├─────────────────────────────────────────────────────────────────┤
│ TICKETS | TICKET_TIMELINE | WORK_ORDERS | WORK_ORDER_ITEMS    │
│ (Ver diagrama expandido abajo)                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📡 INTEGRACIONES EXTERNAS (ISPCube, Mikrotik, SmartOLT)        │
├─────────────────────────────────────────────────────────────────┤
│ CLIENTES | CONNECTIONS | SUBSCRIBERS | NODES | PPP_SECRETS    │
│ (Ver diagrama de integraciones abajo)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Enumeraciones del Sistema

### TicketStatus (Estados de Tickets)
```python
open                  # Recién creado, sin asignación
in_progress          # Operador en investigación
pending              # Esperando acción (cliente, infraestructura)
pending_infra        # Esperando acción de ingeniería/NOC
waiting_internal     # Esperando acción interna
attention_required   # Ingeniería completó, requiere revisión
resolved             # Solucionado
closed               # Archivado
```

### WorkOrderStatus (Estados de Órdenes de Trabajo - NOVO 02/02)
```python
pending_planning   # Pendiente de planificar por coordinador
coordinated        # 📅 Fecha pactada SIN cuadrilla (NUEVO)
scheduled          # 📅 Fecha pactada CON cuadrilla (NUEVO)
assigned           # Asignada a técnico individual (legacy)
in_progress        # Técnico en sitio ejecutando
completed          # Trabajo completado
failed             # Fallo en ejecución
```

**Transiciones típicas coordinadas:**
```
pending_planning
  → (coordinador pacta fecha)
  → coordinated (scheduled_start definido)
  → (coordinador asigna team)
  → scheduled (team_id definido)
  → (técnico comienza)
  → in_progress
  → (técnico termina)
  → completed
```

### Otros Enums Importantes
```python
WorkOrderType: repair, install, pickup, infrastructure
WorkOrderResolutionType: success, failed, rescheduled, partial
ResolutionCategory: infrastructure, equipment, configuration, other
TeamRole: leader, technician
TicketType: technical, installation, withdrawal, relocation, administrative
TicketPriority: low, medium, high, critical
WarehouseType: CENTRAL, MOBILE, VIRTUAL
VehicleStatus: ACTIVE, MAINTENANCE, RETIRED, DONATED
```

---

## 🔗 Relaciones Principales

### Flujo Central: Ticket → Timeline → WorkOrder
```
Ticket (incidente)
  ├─ timeline: [TicketTimeline]      # Bitácora unificada
  │  └─ meta_data: JSONB (contexto flexible)
  │
  ├─ work_orders: [WorkOrder]        # OT derivadas
  │  ├─ status: pending_planning → coordinated → scheduled → in_progress → completed
  │  ├─ team_id: FK→Teams (NUEVO 02/02)
  │  ├─ scheduled_start: datetime UTC (fecha pactada)
  │  ├─ scheduled_end: datetime (start + estimated_duration)
  │  ├─ estimated_duration: int minutos
  │  └─ work_order_items: [WorkOrderItem] (materiales consumidos)
  │
  └─ category: TicketCategory
     └─ reasons: [TicketReason]
```

### Coordinación (NUEVO 02/02/2026)
```
Teams (Cuadrillas)
  ├─ id, name (único), vehicle_id, is_active
  ├─ members: [TeamMember] (usuario + rol)
  └─ work_orders: [WorkOrder] (OT asignadas)
     ├─ scheduled_start: fecha pactada con cliente
     ├─ scheduled_end: calculado automático
     └─ estimated_duration: minutos
```

### Integración Externa (ISPCube/Mikrotik/SmartOLT)
```
Cliente → Connection (pppoe_username clave)
  → Subscriber (SmartOLT)
  → PPP_Secret (Mikrotik)
  → Node (Router)
```

---

## 📊 Índices Críticos (Performance)

### Tickets
```sql
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_creator ON tickets(creator_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to_id);
CREATE INDEX ix_tickets_status_priority ON tickets(status, priority);
```

### Timeline
```sql
CREATE INDEX idx_timeline_ticket ON ticket_timeline(ticket_id);
CREATE INDEX idx_timeline_event_type ON ticket_timeline(event_type);
CREATE INDEX ix_ticket_timeline_ticket_created ON ticket_timeline(ticket_id, created_at);
```

### WorkOrders
```sql
CREATE INDEX idx_work_orders_ticket ON work_orders(ticket_id);
CREATE INDEX idx_work_orders_team ON work_orders(team_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX ix_work_orders_team_scheduled ON work_orders(team_id, scheduled_start);
CREATE INDEX ix_work_orders_ticket_status ON work_orders(ticket_id, status);
```

### Coordinación (NUEVO)
```sql
CREATE INDEX idx_teams_is_active ON teams(is_active);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE UNIQUE INDEX uq_team_members_team_user ON team_members(team_id, user_id);
```

---

## 🔐 Foreign Keys y Constraints

| Entidad | Campo FK | Referencia | Comportamiento |
|---------|----------|-----------|----------------|
| Ticket | creator_id | users.id | SET NULL |
| Ticket | assigned_to_id | users.id | SET NULL |
| TicketTimeline | ticket_id | tickets.id | **CASCADE DELETE** |
| TicketTimeline | author_id | users.id | SET NULL |
| WorkOrder | ticket_id | tickets.id | **CASCADE DELETE** |
| WorkOrder | team_id | teams.id | SET NULL (NUEVO) |
| WorkOrder | technician_id | users.id | SET NULL (deprecated) |
| WorkOrderItem | work_order_id | work_orders.id | **CASCADE DELETE** |
| TeamMember | team_id | teams.id | **CASCADE DELETE** |
| TeamMember | user_id | users.id | **CASCADE DELETE** |

**Notas:**
- CASCADE en relaciones de entidades dependientes (timeline, items, miembros)
- SET NULL en asignaciones dinámicas (flexibilidad de reasignación)
- SOFT FK en campos con referencias a otros módulos

---

## 🚀 Migraciones

| ID | Descripción | Fecha |
|----|-------------|-------|
| `221e88a56548` | Creación inicial | 2025-12-15 |
| `678033205aa3` | Post-stamp sync | 2025-12-20 |
| `8bc58d283e34` | Tickets v2 | 2026-01-02 |
| `7b7dfe8236f8` | Merge heads | 2026-02-02 |
| `2026_02_02_002` | **Coordinación + team_id + scheduled_start/end** | **2026-02-02** |

**Aplicar migraciones:**
```bash
docker compose exec backend alembic upgrade head
```

---

## 📝 Patrones de Consulta

### Obtener Ticket con Timeline
```python
ticket = db.query(Ticket).filter(Ticket.id == 123).first()
for event in ticket.timeline:
    print(f"[{event.created_at}] {event.event_type}: {event.content}")
```

### WorkOrders de un Team (próximos 7 días)
```python
from datetime import datetime, timedelta

today = datetime.utcnow()
week = today + timedelta(days=7)

ots = db.query(WorkOrder)\
  .filter(
    WorkOrder.team_id == 5,
    WorkOrder.status.in_([WorkOrderStatus.scheduled, WorkOrderStatus.in_progress]),
    WorkOrder.scheduled_start >= today,
    WorkOrder.scheduled_start <= week
  )\
  .order_by(WorkOrder.scheduled_start)\
  .all()
```

### Carga de Equipos
```python
from sqlalchemy import func

team_load = db.query(
    WorkOrder.team_id,
    func.count(WorkOrder.id).label('ot_count'),
    func.sum(WorkOrder.estimated_duration).label('total_minutes')
)\
  .filter(
    func.date(WorkOrder.scheduled_start) == tomorrow,
    WorkOrder.status.in_([WorkOrderStatus.scheduled, WorkOrderStatus.in_progress])
  )\
  .group_by(WorkOrder.team_id)\
  .all()
```

---

## 🔧 Operaciones Administrativas

### Backup
```bash
# SQL (legible)
docker compose exec db pg_dump -U postgres emerald > backup.sql

# Binario (rápido, comprimido)
docker compose exec db pg_dump -U postgres -Fc emerald > backup.dump
```

### Restaurar
```bash
docker compose exec -T db psql -U postgres emerald < backup.sql
```

### Monitoreo
```bash
# Tamaño tablas
docker compose exec db psql -U postgres -d emerald -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename)) 
   FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size DESC;"

# Tamaño total
docker compose exec db psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('emerald'));"

# Vacuum
docker compose exec db psql -U postgres -d emerald -c "VACUUM ANALYZE;"
```

---

## 🧩 Patrón Clean Slate (SQLAlchemy 2.0)

**Reglas obligatorias:**

✅ **SIEMPRE:**
```python
from sqlalchemy.orm import Mapped, mapped_column
id: Mapped[int] = mapped_column(Integer, primary_key=True)
nombre: Mapped[str] = mapped_column(String(100), nullable=False)
```

❌ **NUNCA:**
```python
id = Column(Integer, primary_key=True)  # NO
```

---

## 📦 JSONB Flexible

Usar JSONB para datos variantes:

```python
# WorkOrder.custom_data (diagnóstico técnico)
{
    "optical_signal_dbm": -25.5,
    "speedtest_download_mbps": 45.2,
    "onu_serial_installed": "GPON12AB34CD56"
}

# TicketTimeline.meta_data (contexto)
{
    "previous_status": "open",
    "new_status": "in_progress",
    "assigned_technician": {"id": 42, "name": "Juan"}
}
```

---

## 🔒 Seguridad

### Nunca exponer:
- PPPSecret.password
- User.hashed_password
- *.raw_data (datos sensitivos)

### Timestamps (auditoría):
- created_at: cuando se creó
- updated_at: última modificación

### Soft Delete (no borrar):
```python
# ❌ NO hacer
db.delete(ticket)

# ✅ SIEMPRE hacer
ticket.is_deleted = True
db.commit()
```

---

## 📈 Caché

**Sin caché (cambian frecuentemente):**
- WorkOrder status/timeline
- User state
- Stock en tiempo real

**Con caché 24h (rara vez cambian):**
- TicketCategory
- TicketReason
- Plans
- Roles

```python
import redis
cache = redis.Redis(host='redis', port=6379, db=0)

def get_categories():
    key = "ticket_categories"
    cached = cache.get(key)
    if cached:
        return json.loads(cached)
    
    categories = db.query(TicketCategory).all()
    cache.setex(key, 86400, json.dumps([c.to_dict() for c in categories]))
    return categories
```

---

## 🎯 Checklist Pre-Cambio

Antes de modificar schema:

- [ ] Revisar migraciones aplicadas: `alembic current`
- [ ] Hacer backup: `pg_dump`
- [ ] Generar migración: `alembic revision --autogenerate`
- [ ] Revisar archivo migración (¿hay DROP TABLE?)
- [ ] Probar local: `alembic upgrade head`
- [ ] Verificar indices y constraints
- [ ] Ejecutar queries críticas (COUNT en tablas principales)
- [ ] Commit a git con mensaje claro

---

**⚠️ CAMBIOS RECIENTES:**
- ✅ Coordinación (02/02/2026): Team → WorkOrder (N:1 FK), scheduled_start/end, estimated_duration
- ✅ Estados nuevos: coordinated, scheduled
- ✅ Índice compuesto: (team_id, scheduled_start)
- ✅ Fleet module (03/02/2026): Vehicle (activos físicos), 1:1 Vehicle↔Warehouse MOBILE
- ✅ Migración e531d3d1fe20 aplicada ✓ - 3 MOBILE warehouses migrados a vehículos
- ✅ Team.vehicle_id FK integrada con asignación de vehículos a cuadrillas
- ✅ VehicleStatus enum: ACTIVE, MAINTENANCE, RETIRED, DONATED

---

## 🚛 PROFUNDO: Tabla Vehicles (Fleet Module)

### Definición Completa
```sql
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,                      -- Nombre descriptivo
    license_plate VARCHAR(20) UNIQUE NULLABLE,       -- Patente (ej: AB123CD)
    vehicle_brand VARCHAR(50) NULLABLE,              -- Marca (Toyota, Fiat)
    vehicle_model VARCHAR(50) NULLABLE,              -- Modelo (Hilux, Ducato)
    vehicle_year INT NULLABLE,                       -- Año fabricación
    CHECK (vehicle_year >= 1900 AND vehicle_year <= 2200),
    
    status VARCHAR(20) DEFAULT 'ACTIVE',             -- ACTIVE, MAINTENANCE, RETIRED, DONATED
    warehouse_id INT NOT NULL,                       -- FK → warehouses (MOBILE)
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_vehicles_status (status),
    INDEX idx_vehicles_warehouse (warehouse_id),
    UNIQUE INDEX uq_vehicles_license (license_plate)
);
```

### Warehouse MOBILE Asociado
```sql
-- Cuando se crea Vehicle, auto-crea Warehouse:
INSERT INTO warehouses (name, type, user_id, created_at, updated_at)
VALUES (
    CONCAT('Stock - ', vehicle.name),  -- "Stock - Móvil 01"
    'MOBILE',                           -- Tipo MOBILE
    NULL,                               -- No user (deprecated)
    NOW(),
    NOW()
);
-- Luego: UPDATE vehicles SET warehouse_id = last_insert_id() WHERE id = vehicle.id
```

### Relación Team → Vehicle
```sql
ALTER TABLE teams ADD COLUMN vehicle_id INT NULLABLE;
ALTER TABLE teams ADD FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) SET NULL;
CREATE INDEX idx_teams_vehicle (vehicle_id);

-- 🔑 Validación en app: solo 1 team puede tener 1 vehicle
-- Pero si team A pierde vehicle, vehicle está libre para team B
```

### Flujos de Datos (Vehicle Lifecycle)

#### 1️⃣ Crear Vehicle
```
Frontend: POST /api/v2/vehicles { name, license_plate, brand, model, year, status="ACTIVE" }
  │
  ├─ Backend Validation: Pydantic VehicleCreate
  ├─ Constraint Check: license_plate unique
  │
  ├─ DB Transaction:
  │  ├─ INSERT warehouses (MOBILE auto-create)
  │  ├─ INSERT vehicles (warehouse_id = new warehouse)
  │  └─ COMMIT
  │
  └─ Frontend: FleetPage tabla actualiza, toast success

✅ Resultado: Vehicle + Warehouse MOBILE (1:1 relación)
```

#### 2️⃣ Asignar Vehicle a Team
```
Frontend: PUT /api/v2/teams/{id} { vehicle_id: 123 }
  │
  ├─ Validación: vehicle_id existe? status=ACTIVE?
  ├─ Validación: otro team tiene este vehicle?
  │
  ├─ DB:
  │  └─ UPDATE teams SET vehicle_id = 123 WHERE id = team.id
  │
  └─ TeamCard: muestra Truck icon + modelo + patente

✅ Resultado: Team puede usar warehouse MOBILE del vehicle
```

#### 3️⃣ Usar Stock MOBILE en WorkOrder
```
Técnico ejecuta OT: consume item de warehouse MOBILE
  │
  ├─ WorkOrderItem INSERT: { warehouse_id = team.vehicle.warehouse_id, ... }
  ├─ StockBulk UPDATE: quantity -= consumed
  │
  └─ Audit: log consumo + fecha + técnico

✅ Resultado: Stock replicado/sincronizado
```

#### 4️⃣ Mantenimiento (Future)
```
Admin: Dispatch vehículo a service
  │
  ├─ UPDATE vehicles SET status = 'MAINTENANCE' WHERE id = 123
  ├─ API blocka: no permite asignar MAINTENANCE vehicles
  ├─ Mechanical: realiza service
  ├─ UPDATE vehicles SET status = 'ACTIVE' WHERE id = 123
  │
  └─ TeamCard: badge "🔧 Maintenance" desaparece

✅ Resultado: Vehículo fuera de rotación temporalmente
```

---

## 🔍 Queries Útiles (SQL Directo)

### Listar Vehicles Activos con Teams Asignados
```sql
SELECT v.id, v.name, v.license_plate, v.status, 
       t.name AS team_name, w.name AS warehouse_name
FROM vehicles v
LEFT JOIN teams t ON v.id = t.vehicle_id
LEFT JOIN warehouses w ON v.warehouse_id = w.id
WHERE v.status = 'ACTIVE'
ORDER BY v.created_at DESC;
```

### Contar Stock por Vehicle (MOBILE Warehouse)
```sql
SELECT v.name, v.license_plate, 
       p.name AS product, sb.quantity
FROM vehicles v
JOIN warehouses w ON v.warehouse_id = w.id
JOIN stock_bulk sb ON w.id = sb.warehouse_id
JOIN products p ON sb.product_id = p.id
WHERE v.status = 'ACTIVE';
```

### WorkOrders Pendientes por Vehicle
```sql
SELECT v.name, wo.id, wo.status, wo.scheduled_start,
       t.name AS team, COUNT(woi.id) AS qty_items
FROM vehicles v
LEFT JOIN teams t ON v.id = t.vehicle_id
LEFT JOIN work_orders wo ON t.id = wo.team_id
LEFT JOIN work_order_items woi ON wo.id = woi.work_order_id
WHERE wo.status IN ('coordinated', 'scheduled')
GROUP BY v.id, wo.id
ORDER BY wo.scheduled_start ASC;
```

### Vehicles sin Team Asignado
```sql
SELECT id, name, license_plate, status
FROM vehicles
WHERE id NOT IN (SELECT vehicle_id FROM teams WHERE vehicle_id IS NOT NULL)
  AND status = 'ACTIVE';
```

### Auditoría: Vehicle Status Changes (Future)
```sql
-- Cuando se implemente assignment_audit tabla:
SELECT va.vehicle_id, v.name, va.assigned_by_user_id, 
       va.assigned_at, va.unassigned_at, 
       DATEDIFF(va.unassigned_at, va.assigned_at) AS hours_assigned
FROM vehicle_assignments va
JOIN vehicles v ON va.vehicle_id = v.id
WHERE va.assigned_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY va.assigned_at DESC;
```

---

## ❓ FAQ - Fleet & Database

### P: ¿Qué pasa si elimino un Vehicle?
**R:** Constraint ON DELETE RESTRICT lo impide. Debes:
1. Unassign team (UPDATE teams SET vehicle_id = NULL)
2. O cambiar status a RETIRED (soft-delete)

### P: ¿Un Vehicle puede estar sin Team?
**R:** Sí. vehicle.id sin correspondencia en teams.vehicle_id significa "sin asignar".

### P: ¿Un Team puede estar sin Vehicle?
**R:** Sí. team.vehicle_id = NULL significa "equipo sin vehículo". Allowed.

### P: ¿Qué pasa con el Warehouse si cambio Vehicle?
**R:** Warehouse se mantiene porque es FK en Vehicle. No se hereda.
Solución: Transferir stock manualmente vía TransferWarehouse.

### P: ¿Por qué vehicle.status es STRING y no ENUM nativo?
**R:** Alembic no soporta ENUM migrations limpiamente en PostgreSQL.
Usamos VARCHAR con constraint CHECK en SQL.

### P: ¿Se puede tener 2 Vehicles con misma Patente?
**R:** No. UNIQUE (license_plate) lo evita. Si NULL, permite múltiples.

### P: ¿Cuándo se da de baja un Vehicle?
**R:** Status → RETIRED (soft-delete, no aparece en selectors activos).
Warehouse asociado sigue existiendo para auditoría.

---

## 🔐 Constraints y Integridad Referencial

| Constraint | Tabla | Campo | Referencia | Delete |
|-----------|-------|-------|-----------|--------|
| PK | vehicles | id | - | - |
| FK | vehicles | warehouse_id | warehouses.id | **RESTRICT** |
| FK | teams | vehicle_id | vehicles.id | **SET NULL** |
| UK | vehicles | license_plate | - | - |
| CHECK | vehicles | vehicle_year | 1900-2200 | - |
| CHECK | vehicles | status | ENUM | - |

---

## 📈 Performance: Índices Recomendados

```sql
-- Fleet-specific
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_warehouse ON vehicles(warehouse_id);
CREATE INDEX idx_teams_vehicle ON teams(vehicle_id);

-- Cross-module
CREATE INDEX idx_work_orders_team_scheduled ON work_orders(team_id, scheduled_start);
CREATE INDEX idx_stock_bulk_warehouse ON stock_bulk(warehouse_id);
CREATE INDEX idx_work_order_items_warehouse ON work_order_items(consumed_from_warehouse_id);

-- Auditoría (future)
-- CREATE INDEX idx_vehicle_assignments_dates ON vehicle_assignments(assigned_at, unassigned_at);
```

**Análisis EXPLAIN:**
```bash
# Antes de agreg índice
EXPLAIN ANALYZE SELECT * FROM vehicles WHERE status = 'ACTIVE';
# Seq Scan on vehicles (cost=0.00..35.50 rows=2 width=145)

# Después
Sequential Scan (cost=0.54..1.30 rows=2) + Index Scan
```

---

## 🧪 Test Queries (Verificar Integridad)

```sql
-- ✅ Test 1: No hay vehicles sin warehouse
SELECT COUNT(*) FROM vehicles WHERE warehouse_id IS NULL;
-- Expected: 0

-- ✅ Test 2: No hay teams con vehicles no-activos
SELECT COUNT(*) FROM teams 
WHERE vehicle_id IS NOT NULL 
  AND vehicle_id NOT IN (SELECT id FROM vehicles WHERE status = 'ACTIVE');
-- Expected: 0

-- ✅ Test 3: Total vehicles y warehouses MOBILE
SELECT COUNT(*) AS vehicles, 
       (SELECT COUNT(*) FROM warehouses WHERE type = 'MOBILE') AS mobile_warehouses
FROM vehicles;
-- Expected: SAME COUNT (1:1)

-- ✅ Test 4: Duplicadas patentes (should be 0)
SELECT license_plate, COUNT(*) 
FROM vehicles 
WHERE license_plate IS NOT NULL 
GROUP BY license_plate 
HAVING COUNT(*) > 1;
-- Expected: NO ROWS
```

---

**Última revisión:** 2 de marzo de 2026
**Próximas features:** Mantenimiento programado (NUEVO status?), Combustible tracking


