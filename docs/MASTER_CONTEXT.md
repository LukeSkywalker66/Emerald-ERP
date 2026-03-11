# 📘 Master Context - Emerald ERP

**Versión:** 2026-03-09 (Comprehensive Reference)  
**Propósito:** Documentación completa para cualquiera que necesite entender el sistema  
**Audiencia:** Architects, Developers, DevOps, Product Managers

---

## 1️⃣ Descripción General

**Emerald ERP** es un sistema de gestión integral diseñado para un ISP (Internet Service Provider) en Argentina. Integra:

- **Sistema de Tickets** multi-flujo (técnico, instalación, retiro, traslado, administrativo)
- **Órdenes de Trabajo** con coordinación de equipos
- **Flota de Vehículos** operativos con almacenes móviles
- **Inventario** centralizado + mobile
- **Ingeniería/NOC** con tablero Kanban
- **Auditoría Universal** (Ojo de Dios) admin-only con JSONB diff tracking
- **Integraciones** con ISPCube, Mikrotik, SmartOLT

**Estado:** ✅ Production Ready (all modules)  
**Última actualización:** 9 de marzo de 2026

---

## 2️⃣ Stack Tecnológico

### 2.1 Infraestructura
```
┌─ Docker Compose (orquestación)
├─ Nginx (reverse proxy + SSL/TLS)
├─ Let's Encrypt (certificados auto)
├─ Volumes para persistencia
└─ Network: bridge (inter-container)
```

### 2.2 Backend
| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|----------|
| **Lenguaje** | Python | 3.11 | Tipado, productivo |
| **Framework** | FastAPI | 0.104+ | Async, autodocs (Swagger) |
| **ORM** | SQLAlchemy | 2.0 | Type-safe, migrations |
| **Migraciones** | Alembic | - | Versionado DB |
| **Async** | Uvicorn | - | ASGI server |
| **Task Queue** | Celery | - | Jobs background |
| **Cache** | Redis | - | Session, cache |

### 2.3 Frontend
| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|----------|
| **Framework** | React | 19 | UI interactivo |
| **Bundler** | Vite | 7.3 | Build rápido |
| **CSS** | Tailwind CSS | 3 | Utilidades |
| **UI Lib** | Shadcn/UI | - | Componentes accesibles |
| **Iconos** | Lucide React | - | 1000+ icons |
| **Router** | React Router | 7 | Client-side routing |
| **State** | Hooks (useState/useEffect) | - | Manejo local |

### 2.4 Base de Datos
```
PostgreSQL 15 Alpine
├─ ACID transactions
├─ JSONB para datos semi-estructurados
├─ Native enums (VehicleStatus, TicketStatus, etc.)
├─ UUID & Array types
├─ Triggers & stored procedures (auditoría)
└─ Índices compuestos para performance
```

---

## 3️⃣ Estructura del Proyecto

```
emerald-erp/
│
├── backend/
│   ├── src/
│   │   ├── main.py                     # FastAPI app entry
│   │   ├── config.py                   # Env vars
│   │   ├── database.py                 # PostgreSQL session
│   │   │
│   │   ├── models/                     # SQLAlchemy models
│   │   │   ├── __init__.py             # Exports
│   │   │   ├── user.py                 # Users, roles
│   │   │   ├── tickets.py              # Tickets, timeline
│   │   │   ├── work_orders.py          # OT, items
│   │   │   ├── coordination.py         # Teams, members
│   │   │   ├── fleet.py                # Vehicles (NEW)
│   │   │   ├── inventory.py            # Warehouses, stock
│   │   │   ├── engineering.py          # Tasks, timeline
│   │   │   └── locations.py            # Geolocation
│   │   │
│   │   ├── schemas/                    # Pydantic validation
│   │   │   ├── user_schemas.py
│   │   │   ├── ticket_schemas.py
│   │   │   ├── fleet.py                # Vehicle*
│   │   │   └── ...
│   │   │
│   │   ├── routers/                    # API endpoints
│   │   │   ├── v1/
│   │   │   │   └── auth.py             # Login, token
│   │   │   ├── tickets_v2.py           # /api/v2/tickets
│   │   │   ├── work_orders_v2.py       # /api/v2/work-orders
│   │   │   ├── coordination.py         # /api/v2/teams
│   │   │   ├── fleet.py                # /api/v2/vehicles (NEW)
│   │   │   ├── inventory.py            # /api/v2/warehouses
│   │   │   └── engineering.py          # /api/v2/engineering
│   │   │
│   │   ├── services/                   # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── ticket_service.py
│   │   │   ├── work_order_service.py
│   │   │   └── ...
│   │   │
│   │   ├── clients/                    # External API clients
│   │   │   ├── ispcube.py              # ISP CRM/Billing
│   │   │   ├── mikrotik.py             # Router PPPoE
│   │   │   └── smartolt.py             # ONU/Fibra
│   │   │
│   │   └── utils/
│   │       ├── security.py             # JWT, Argon2
│   │       └── ...
│   │
│   ├── alembic/
│   │   └── versions/
│   │       ├── e531d3d1fe20_fleet_refactor_vehicle_model.py  (NEW)
│   │       ├── 2026_02_02_001_coordination.py
│   │       └── ... (40+ migrations)
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── TicketsPage.jsx
│   │   │   ├── WorkOrdersPage.jsx
│   │   │   ├── coordination/
│   │   │   │   ├── CuadrillasPage.jsx  # Teams CRUD
│   │   │   │   └── CoordinationGridPage.jsx
│   │   │   ├── fleet/
│   │   │   │   └── FleetPage.jsx       # Vehicles CRUD (NEW)
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryPage.jsx
│   │   │   │   └── WarehousePage.jsx
│   │   │   └── engineering/
│   │   │       ├── EngineeringPage.jsx
│   │   │       └── TimelinePage.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Shadcn components
│   │   │   │   ├── button.jsx
│   │   │   │   ├── dialog.jsx
│   │   │   │   ├── card.jsx
│   │   │   │   └── ...
│   │   │   ├── fleet/                  # Fleet-specific (NEW)
│   │   │   │   ├── CreateVehicleDialog.jsx
│   │   │   │   └── EditVehicleDialog.jsx
│   │   │   ├── coordination/
│   │   │   │   ├── TeamCard.jsx        # (updated: shows vehicle)
│   │   │   │   └── ...
│   │   │   └── ... (50+ components)
│   │   │
│   │   ├── services/
│   │   │   ├── api/
│   │   │   │   └── client.js           # Axios instance
│   │   │   ├── fleet.service.js        # Vehicle API calls (NEW)
│   │   │   ├── tickets.service.js
│   │   │   ├── coordination.service.js
│   │   │   └── ...
│   │   │
│   │   ├── hooks/
│   │   │   ├── useOptimisticUpdates.js
│   │   │   └── ...
│   │   │
│   │   └── App.jsx                     # Router setup
│   │
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docker-compose.yml
├── init-letsencrypt.sh
├── README.md                           # Start here
├── BASE_DATOS.md                       # DB schema
├── FLEET_MODULE.md                     # Fleet docs (NEW)
├── AI_ARCHITECT_CONTEXT.md             # Para IAs
└── CURRENT_STATUS_2026-03-02.md        # Session snapshot
```

---

## 4️⃣ Modelos de Datos Principales

### 4.1 Usuarios y Autenticación
```python
class User(Base):
    id: int, email (unique), hashed_password, first_name, last_name,
    role_id (FK→Role), is_active, created_at, updated_at

class Role(Base):
    id: int, name (unique), description, permissions (JSONB)
```

### 4.2 Tickets (Core)
```python
class Ticket(Base):
    id, title, description, status (enum),
    priority (low/medium/high/critical),
    type (technical/install/withdrawal/relocation/admin),
    creator_id (FK→User), assigned_to_id (FK→User, nullable),
    category_id (FK→TicketCategory),
    reason_id (FK→TicketReason),
    created_at, updated_at

class TicketTimeline(Base):
    id, ticket_id (FK→Ticket, CASCADE),
    event_type, author_id (FK→User),
    previous_status, new_status,
    meta_data (JSONB - flexible contexto),
    created_at

class TicketCategory(Base):
    id, name, description, is_active

class TicketReason(Base):
    id, category_id (FK→Category), name, description
```

### 4.3 Órdenes de Trabajo
```python
class WorkOrder(Base):
    id, ticket_id (FK→Ticket, CASCADE),
    type (repair/install/pickup/infrastructure),
    status (pending_planning/coordinated/scheduled/in_progress/completed),
    team_id (FK→Teams, nullable) # NEW 02/02
    scheduled_start (datetime UTC),
    estimated_duration (int minutos),
    coordination_notes (text),
    created_at, updated_at

class WorkOrderItem(Base):
    id, work_order_id (FK→WorkOrder, CASCADE),
    product_id (FK→Product),
    quantity_used, batch_number, serial (nullable),
    consumed_from_warehouse_id (FK→Warehouse)
```

### 4.4 Coordinación (NEW 02/02)
```python
class Team(Base):
    id, name (unique), vehicle_id (FK→Vehicle, nullable) # NEW 03/02
    is_active, created_at, updated_at

class TeamMember(Base):
    id, team_id (FK→Team, CASCADE),
    user_id (FK→User, CASCADE),
    role (enum: leader/technician),
    UC: (team_id, user_id)
```

### 4.5 Flota (NEW 03/02)
```python
class Vehicle(Base):
    id, name (descriptive), license_plate (unique, nullable),
    vehicle_brand (nullable), vehicle_model (nullable),
    vehicle_year (int: 1900-2200, nullable),
    status (enum: ACTIVE/MAINTENANCE/RETIRED/DONATED),
    warehouse_id (FK→Warehouse, RESTRICT) # 1:1 MOBILE warehouse
    created_at, updated_at

# ⚡ Key: POST /api/v2/vehicles auto-crea Warehouse tipo MOBILE
# No hay Vehicle huérfano, siempre con warehouse asignado
```

### 4.6 Inventario
```python
class Warehouse(Base):
    id, name, type (enum: CENTRAL/MOBILE/VIRTUAL),
    user_id (FK→User, nullable, DEPRECATED),
    vehicle (REL optional: Vehicle) # NEW 03/02
    created_at, updated_at

class Product(Base):
    id, name, sku (unique),
    type (enum: SERIALIZED/BULK),
    category, min_stock_alert

class StockBulk(Base):
    id, warehouse_id (FK→Warehouse),
    product_id (FK→Product),
    quantity, last_updated

class SerialItem(Base):
    id, warehouse_id (FK→Warehouse),
    product_id (FK→Product),
    serial (unique), status (NEW/USED/DAMAGED/INSTALLED),
    batch_number, install_date (nullable)
```

### 4.7 Ingeniería/NOC
```python
class EngineeringTask(Base):
    id, title, description, status (TODO/IN_PROGRESS/DONE),
    category, assigned_to_id (FK→User),
    priority, created_at, updated_at

class EngineeringTimeline(Base):
    id, task_id (FK→Task),
    event_type, author_id (FK→User),
    meta_data (JSONB)
```

### 4.8 Auditoría Universal (NEW 09/03/2026) 🔍
```python
class AuditLog(Base):
    """Motor de Auditoría - 'Ojo de Dios'"""
    id: int (PK)
    
    # ─── Capa 1: Quién hizo qué ───
    user_id: int (FK→User, nullable)  # NULL para sistema
    action: AuditAction (enum)
    ip_address: VARCHAR (nullable)
    user_agent: VARCHAR (nullable)
    
    # ─── Capa 2: Sobre qué entidad ───
    entity_name: VARCHAR(100)  # "products", "warehouses", "work_orders"
    entity_id: int (nullable)   # ID del registro afectado
    
    # ─── Capa 3: Qué cambió exactamente ───
    old_values: JSONB (nullable)  # Estado anterior (UPDATE/DELETE)
    new_values: JSONB (nullable)  # Estado nuevo (CREATE/UPDATE)
    
    # ─── Metadata ───
    status: VARCHAR  # "success" | "failure"
    error_message: TEXT (nullable)
    created_at: datetime (UTC)

class AuditAction(Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    ACCESS_DENIED = "ACCESS_DENIED"
    EXPORT = "EXPORT"
    IMPORT = "IMPORT"
```

**Endpoints auditados (13 totales):**
- **Inventory (6)**: Products CRUD, Warehouses CRUD, Stock Transfers
- **Users (4)**: CREATE, Role change, Status toggle, DELETE
- **WorkOrders (3)**: CREATE, UPDATE, Team assignment

**Helper Functions:**
```python
from src.utils.audit import log_create, log_update, log_delete, get_entity_dict

# CREATE
log_create(db, user_id=5, entity_name="products", entity_id=42, 
           new_values={"name": "Router TP-Link", "sku": "TL-WR840N"})

# UPDATE
log_update(db, user_id=5, entity_name="warehouses", entity_id=10,
           old_values={"name": "Almacén A"}, 
           new_values={"name": "Almacén Principal"})

# DELETE
log_delete(db, user_id=5, entity_name="users", entity_id=99,
           old_values=get_entity_dict(user_to_delete))
```

**Arquitectura:**
- Try/Except safety: Fallo de audit NO aborta transacción principal
- JSON serialization automática: datetime → ISO string, Enum → .value
- RBAC: Solo admin puede acceder a `/v2/audit-logs`
- Frontend: Monitor táctico con tabla, filtros (entity/action/user), modal JSON diff

**Datos migrados:** 1378 registros legacy (login, user.create, etc.)

---

## 5️⃣ API Endpoints (v2)

### 5.1 Auditoría (NEW 09/03/2026) 🔐 Admin-only
```
GET    /api/v2/audit-logs                    # Lista paginada con filtros
  ?entity_name=products                      # Filtrar por entidad
  &action=CREATE                              # Filtrar por acción
  &user_id=5                                  # Filtrar por usuario
  &status_filter=success                      # success | failure
  &limit=100                                  # 1-500, default: 100
  &offset=0                                   # Paginación

GET    /api/v2/audit-logs/{id}               # Detalle de un registro

Response:
{
  "items": [
    {
      "id": 1532,
      "user_id": 5,
      "user_name": "admin",  # Computado
      "action": "UPDATE",
      "entity_name": "warehouses",
      "entity_id": 42,
      "old_values": {"name": "Almacén A"},
      "new_values": {"name": "Almacén Principal"},
      "created_at": "2026-03-09T22:56:00Z",
      "status": "success"
    }
  ],
  "total": 1532,
  "limit": 100,
  "offset": 0
}
```

### 5.2 Vehículos (03/02/2026)
```
POST   /api/v2/vehicles              # Crear vehicle + warehouse
GET    /api/v2/vehicles              # Listar (filtrable: ?status=ACTIVE)
GET    /api/v2/vehicles/{id}         # Detalle con team asignado
PUT    /api/v2/vehicles/{id}         # Actualizar
DELETE /api/v2/vehicles/{id}         # Soft-delete
```

### 5.2 Coordinación
```
GET    /api/v2/teams                 # Listar cuadrillas
POST   /api/v2/teams                 # Crear
PUT    /api/v2/teams/{id}            # Actualizar (incl. vehicle_id)
POST   /api/v2/teams/{id}/members    # Agregar miembro
```

### 5.3 Tickets
```
GET    /api/v2/tickets               # Listar (filtrable)
POST   /api/v2/tickets               # Crear
GET    /api/v2/tickets/{id}          # Detalle + timeline
PUT    /api/v2/tickets/{id}/status   # Cambiar estado
POST   /api/v2/tickets/{id}/timeline # Agregar evento
```

### 5.4 Órdenes de Trabajo
```
GET    /api/v2/work-orders           # Listar
POST   /api/v2/work-orders           # Crear
GET    /api/v2/work-orders/{id}      # Detalle
PUT    /api/v2/work-orders/{id}      # Actualizar (incl. team_id)
```

### 5.5 Inventario
```
GET    /api/v2/warehouses            # Listar
GET    /api/v2/warehouses/{id}/stock # Stock actual
POST   /api/v2/transfers             # Mover entre warehouses
```

---

## 6️⃣ Enumeraciones (Enums)

```python
# Tickets
TicketStatus: open, in_progress, pending, resolved, closed
TicketPriority: low, medium, high, critical
TicketType: technical, installation, withdrawal, relocation, administrative

# WorkOrders
WorkOrderStatus: pending_planning, coordinated, scheduled, in_progress, completed
WorkOrderType: repair, install, pickup, infrastructure

# Coordinación
TeamRole: leader, technician

# Fleet (NEW)
# Fleet
VehicleStatus: ACTIVE, MAINTENANCE, RETIRED, DONATED

# Inventario
WarehouseType: CENTRAL, MOBILE, VIRTUAL
ProductType: SERIALIZED, BULK
# Auditoría (NEW 09/03/2026)
AuditAction: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ACCESS_DENIED, EXPORT, IMPORT


# General
Priority: low, medium, high, critical
```

---

## 7️⃣ Patrones y Convenciones

### 7.1 Nombrado
```
Tables: snake_case (vehicles, team_members)
Columns: snake_case (license_plate, is_active)
APIs: kebab-case (/api/v2/work-orders)
Frontend: camelCase (vehicleName, isActive)
Enums: UPPERCASE (ACTIVE, MAINTENANCE)
```

### 7.2 Timestamps
```
created_at: momento de creación (IMMUTABLE)
updated_at: última modificación (MUTABLE)
deleted_at: para soft-delete (nullable)
Siempre UTC, never local timezone
```

### 7.3 Soft Delete
```python
# ❌ NUNCA
db.delete(ticket)
db.commit()

# ✅ SIEMPRE
ticket.is_deleted = True  # o deleted_at = datetime.utcnow()
db.commit()
# El record sigue en DB para auditoría
```

### 7.4 Validación
```python
# Pydantic side
class VehicleCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    license_plate: Optional[str] = Field(None, max_length=20)
    status: str = Field(default="ACTIVE")

# DB side
CHECK vehicle_year >= 1900 AND vehicle_year <= 2200
UNIQUE (license_plate)
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
```

---

## 8️⃣ Flujos de Negocio

### Flujo: Soporte → Coordinación → Ejecución
```
┌─ 1. Support abre TICKET
├─ 2. System crea TICKET_TIMELINE entry
├─ 3. Coordinador crea WORK_ORDER (status=pending_planning)
├─ 4. Coordinador pacta fecha (scheduled_start) → status=coordinated
├─ 5. Coordinador asigna TEAM con VEHICLE → status=scheduled
├─ 6. Técnico ve en coordinación (grid map)
├─ 7. Técnico ejecuta (consume stock MOBILE warehouse)
├─ 8. Técnico cierra → status=completed
└─ 9. Stock auditado + timeline completo
```

### Flujo: Crear Vehículo (NEW)
```
┌─ 1. Admin: POST /api/v2/vehicles (name, plate, brand, model, year, status)
├─ 2. Backend: Valida datos + patente única
├─ 3. Backend: Crea Vehicle record
├─ 4. Backend: Auto-crea Warehouse tipo MOBILE (Stock - {vehicle.name})
├─ 5. Backend: FK vehicle.warehouse_id → warehouse.id
└─ 6. Frontend: Aparece en FleetPage tabla
```

### Flujo: Asignar Vehículo a Equipo (NEW)
```
┌─ 1. Coordinador: CuadrillasPage → Crear/Editar Team
├─ 2. Selector: Muestra vehículos ACTIVE (sin asignar)
├─ 3. Selecciona: team.vehicle_id = vehicle.id
├─ 4. Guarda: PUT /api/v2/teams/{id}
└─ 5. TeamCard: Ahora muestra modelo + patente + warehouse
```

---

## 9️⃣ Testing y QA

### Validación Manual
1. **Fleet:**
   - Crear vehículo → warehouse MOBILE auto-creado
   - Asignar a team → TeamCard muestra datos
   - Editar/Delete → cambios reflejados

2. **Coordinación:**
   - Crear team, listar vehículos disponibles
   - Asignar vehículo, verificar TeamCard

3. **Tickets:**
   - Crear ticket, crear OT, asignar team
   - Timeline captura transiciones

### Tests E2E (Recomendado)
```python
# Backend
def test_create_vehicle():
    response = client.post("/api/v2/vehicles", json=payload)
    assert response.status_code == 201
    assert response.json()["warehouse_id"] is not None

# Frontend
it("should show vehicle selector in create team dialog", () => {
    render(<CreateTeamDialog {...props} />);
    expect(screen.getByText("Seleccionar vehículo...")).toBeInTheDocument();
});
```

---

## 🔟 Performance y Optimizaciones

### Índices Críticos
```sql
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_teams_vehicle ON teams(vehicle_id);
CREATE INDEX idx_work_orders_team_scheduled ON work_orders(team_id, scheduled_start);
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority);
```

### Caché
```python
# 24h cache (rara vez cambian)
- TicketCategory, TicketReason
- Roles, permissions
- Products catalog

# No cachear (cambian frecuentemente)
- WorkOrder status, timeline
- Stock en tiempo real
- User sessions
```

### Bundle Frontend
```
Size: 958.45 kB (gzipped 263.58 kB)
Build time: 8.90s (Vite)
Modules: 2697 transformed
Performance: ✅ Good
```

---

## 1️⃣1️⃣ Guard Rails Operativos (Campo)

### A. Motor de Auditoría Universal (Backend)
- `log_create`, `log_update`, `log_delete` inyectados en endpoints críticos.
- Patrón obligatorio: `try/except` no bloqueante alrededor del audit log.
- Si la auditoría falla, la operación de negocio continúa y se loguea error.

### B. Prisión del Técnico por OTs vencidas (Hard Block real)
- Aplicado en `WorkOrdersPage` para técnicos con OTs en `pending_closure`.
- Bloquea la ejecución operativa del técnico hasta cerrar pendientes.
- En Coordinación (`CoordinationGrid`): NO bloquea asignar/programar equipos con vencidas.
- Para Coordinador y Gerencia se mantiene alerta visual roja (badge/mensaje), pero la acción está permitida.
- Objetivo: forzar cierre documental (notas/evidencia) sin paralizar la oficina de coordinación.

### C. Prisión por Inspección de Vehículo (Action Block)
- Requiere inspección pre-trip diaria para vehículo asignado.
- UX diseñada para productividad:
    - ✅ Permite ver lista de OTs y abrir detalle (preparar materiales/ruta).
    - ❌ Bloquea botones de mutación de estado (`Iniciar`, `Completar`) hasta inspección.
- Mensaje UX: "Complete la inspección del vehículo primero".
- Backend guard: `PATCH /v2/work-orders/{id}` rechaza activación sin inspección con `403`.

### D. Redundancia de Cuadrilla (Desbloqueo compartido)
- Regla backend: inspección validada por `vehicle_id + inspection_date`.
- Endpoint: `GET /api/v2/fleet/vehicles/{vehicle_id}/inspections/today`.
- No depende del `technician_id` que cargó la planilla.
- Resultado: si ayudante carga inspección, líder también queda desbloqueado.

### E. Ficha Clínica de Vehículo (Gestión)
- En módulo Flota se habilita "Ver Historial" por vehículo (RBAC con `<Can resource="inventory" action="edit">`).
- Fuente de datos: `GET /api/v2/fleet/inspections?vehicle_id={id}`.
- Orden: `inspection_date DESC` (más reciente primero).
- Columnas: fecha, técnico, km, estado (`OK/NEEDS_ATTENTION/CRITICAL`) y observaciones.

---

## 🤖 Integración con Sistemas Externos

### ISPCube (Clientes + Conexiones)
```python
# Endpoint
GET /api/v1/v2/clientes?documento=...
GET /api/v1/v2/servicios?cliente_id=...

# Emergente: Billing source of truth
# Emerald: Operativo source of truth
```

### Mikrotik (PPPoE)
```python
# Sincronización nocturna cron
UPDATE ppp_secrets WHERE ...
# Técnico usa en OT para acceso remoto
```

### SmartOLT (ONUs/Fibra)
```python
# Sync ONUs activas
# Merge con conexiones ISPCube
# Diagnóstico en tickets
```

---

## 📚 Documentación Adicional

- **[BASE_DATOS.md](BASE_DATOS.md)** - Esquema detallado, índices, constraints
- **[FLEET_MODULE.md](FLEET_MODULE.md)** - Fleet specific (flows, testing)
- **[AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md)** - Para IAs/agents
- **[CURRENT_STATUS_2026-03-02.md](CURRENT_STATUS_2026-03-02.md)** - Snapshot sesión
- **[API Docs Live](http://localhost:8500/docs)** - Swagger interactivo

---

## 🎯 Resumen Rápido

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde empezar? | [README.md](README.md) (2 min) |
| ¿Cuál es el stack? | Sección 2 arriba |
| ¿Cómo crear vehículo? | POST `/api/v2/vehicles`, autom warehouse MOBILE |
| ¿Dónde están modelos? | `backend/src/models/` |
| ¿Dónde están endpoints? | `backend/src/routers/` |
| ¿Dónde están componentes? | `frontend/src/components/` |
| ¿Cómo migrar BD? | `alembic revision --autogenerate` |
| ¿Error 500? | `docker logs emerald_backend \| tail -20` |
| ¿Next features? | Auditoría vehicle, mantenimiento, tracking |

---

**Versión:** 2026-03-10  
**Mantenedor:** LukeSkywalker66  
**Actualización Última:** Auditoría universal + inspecciones pre-trip + action block de ejecución
