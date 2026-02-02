# 🎭 MASTER_CONTEXT - Emerald ERP -

**Documento de Referencia Arquitectónica para Arquitectos**  
*Última actualización: 2 de Febrero 2026*

---

## 📚 Tabla de Contenidos

1. [Stack Tecnológico](#-stack-tecnológico)
2. [Estructura del Proyecto](#-estructura-del-proyecto)
3. [Modelo de Datos](#-modelo-de-datos)
4. [Módulos Funcionales](#-módulos-funcionales)
5. [Reglas de Negocio Clave](#-reglas-de-negocio-clave)
6. [Patrones Arquitectónicos](#-patrones-arquitectónicos)

---

## 🏗️ Stack Tecnológico

### Infraestructura Base

| Componente | Tecnología | Versión | Puerto | Rol |
|---|---|---|---|---|
| **Orquestación** | Docker & Docker Compose | latest | — | Contenedores y networking |
| **SSL/TLS** | Nginx + Let's Encrypt | Alpine/latest | 80, 443 | Reverse proxy y certificados |
| **Monitoreo** | Redis (incluyendo cache) | Alpine | 6379 | Message broker + caché |

### Backend

| Componente | Stack | Versión | Notas |
|---|---|---|---|
| **Runtime** | Python | 3.11 | Slim base image para producción |
| **Framework Web** | FastAPI | 0.104.1+ | Async, ASGI, auto-docs (OpenAPI) |
| **ASGI Server** | Uvicorn | latest | Puerto 8500 interno, recargable |
| **ORM** | SQLAlchemy | 2.0+ | Mapped types (SQLAlchemy 2.0 native) |
| **Migraciones** | Alembic | 1.12.1+ | Versionado de esquema |
| **Async Tasks** | Celery | latest | Con Redis como broker y backend |
| **Validación** | Pydantic | v2 | Schemas y coerción |
| **Auth** | python-jose + Argon2 | latest | JWT + hash seguro de passwords |

**Dependencias clave (requirements.txt):**
- `fastapi`, `uvicorn[standard]`
- `sqlalchemy`, `psycopg2-binary`, `alembic`
- `celery`, `redis`
- `passlib[argon2]`, `python-jose[cryptography]`
- `pydantic[email]`, `python-multipart`
- `requests` (para integraciones ISPCube, Mikrotik, SmartOLT)
- `python-dotenv`, `loguru`

### Base de Datos

| Componente | Versión | Rol |
|---|---|---|
| **PostgreSQL** | 15 Alpine | Almacén principal de datos |
| **Tipo de datos especial** | JSONB | Para datos flexibles (eventos, custom fields) |
| **Volumen** | `postgres_data` | Persistencia de datos entre reinicios |

**Health Checks:**
- PostgreSQL: `pg_isready` cada 5 segundos
- Validación en backend antes de iniciar

### Frontend Principal

| Componente | Stack | Versión | Rol |
|---|---|---|---|
| **Runtime** | Node.js | 22 Alpine | Build y ejecución |
| **Framework** | React | 19+ | UI components |
| **Build Tool** | Vite | 5.0+ | Hot reload y bundling |
| **CSS** | Tailwind CSS | 3+ | Utility-first + dark mode |
| **UI Components** | Shadcn/ui | latest | Componentes accesibles |
| **Icons** | Lucide Icons | latest | SVG icons |
| **Router** | React Router | 7+ | Client-side routing |

**Proxy Setup (Vite):**
```javascript
// Todas las requests a /api se forwardean a backend:8500
// Desarrollo: http://localhost:8500 
// Docker: http://backend:8500
```

### Frontend de Monitoreo (Beholder)

| Componente | Uso |
|---|---|
| **Rol** | Dashboard diagnóstico de ISP (redundante con módulo Engineering, legacy) |
| **Puerto** | 5173 (mismo que frontend principal) |
| **Status** | Legacy - En deuda técnica |

---

## 📂 Estructura del Proyecto

### Árbol de Directorios (Simplificado)

```
emerald-erp/
│
├── 📁 backend/                                  # API REST (FastAPI + PostgreSQL)
│   ├── src/
│   │   ├── main.py                             # Entry point (FastAPI, middlewares, rutas)
│   │   ├── celery_app.py                       # Configuración de Celery
│   │   ├── database.py                         # SessionLocal, engine, Base ORM
│   │   ├── config.py                           # Variables de entorno (config.py)
│   │   │
│   │   ├── 📁 models/                          # Modelos SQLAlchemy 2.0
│   │   │   ├── user.py                         # User, Role, APIKey
│   │   │   ├── tickets.py                      # Ticket, WorkOrder, TicketTimeline
│   │   │   ├── inventory.py                    # Warehouse, Product, StockMovement
│   │   │   ├── engineering.py                  # Task, Kanban, Timeline (módulo NOC)
│   │   │   ├── audit.py                        # AuditLog, RateLimit
│   │   │   └── beholder.py                     # Legacy diagnostic data
│   │   │
│   │   ├── 📁 schemas/                         # Pydantic models (request/response)
│   │   │   ├── tickets.py                      # TicketCreate, TicketResponse, etc.
│   │   │   ├── users.py                        # UserCreate, UserResponse
│   │   │   ├── inventory.py                    # ProductCreate, MovementResponse
│   │   │   └── ...
│   │   │
│   │   ├── 📁 routers/                         # Endpoints FastAPI
│   │   │   ├── v1/                             # Legacy endpoints (deprecated)
│   │   │   │   └── auth.py                     # Login, refresh token
│   │   │   ├── v2/                             # New modular endpoints
│   │   │   │   ├── tickets.py                  # POST /v2/tickets, GET /v2/tickets/{id}
│   │   │   │   ├── users.py                    # CRUD de usuarios
│   │   │   │   ├── roles.py                    # Gestión de roles
│   │   │   │   └── ...
│   │   │   ├── tickets.py                      # Merged router (includes categories)
│   │   │   ├── work_orders.py                  # OT endpoints
│   │   │   ├── inventory.py                    # Stock management
│   │   │   ├── engineering.py                  # NOC/Kanban
│   │   │   └── search.py                       # Búsqueda global
│   │   │
│   │   ├── 📁 services/                        # Lógica de negocio
│   │   │   ├── ticket_service.py               # Crear tickets, categorías dinámicas
│   │   │   ├── work_order_service.py           # Lógica de OT
│   │   │   ├── inventory_service.py            # Stock, movimientos
│   │   │   ├── engineering_service.py          # Kanban, timeline
│   │   │   ├── api_key_service.py              # Validación de API keys
│   │   │   └── ...
│   │   │
│   │   ├── 📁 clients/                         # Integraciones externas
│   │   │   ├── ispcube_client.py               # CRM/Billing (RouterOS, facturas)
│   │   │   ├── mikrotik_client.py              # Manejo de PPPoE
│   │   │   └── smartolt_client.py              # ONUs, fibra
│   │   │
│   │   ├── 📁 db/                              # Queries customizadas (sin usar ORM)
│   │   │   └── ...
│   │   │
│   │   ├── 📁 jobs/                            # Tareas asincrónicas (Celery)
│   │   │   ├── ticket_jobs.py                  # Auto-resolution, escalaciones
│   │   │   ├── work_order_jobs.py              # Asignación, reminders
│   │   │   └── ...
│   │   │
│   │   └── 📁 utils/                           # Utilitarios
│   │       ├── exceptions.py                   # Errores custom
│   │       ├── validators.py                   # Validaciones
│   │       └── logger.py                       # Loguru config
│   │
│   ├── alembic/                                # Migraciones de BD
│   │   ├── versions/                           # Scripts de migración (timestamp_name.py)
│   │   ├── env.py                              # Configuración de Alembic
│   │   └── alembic.ini                         # Settings
│   │
│   ├── requirements.txt                        # Dependencias Python
│   ├── Dockerfile                              # Python 3.11 + FastAPI
│   └── ...
│
├── 📁 frontend/                                # SPA Principal (React + Vite)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js                       # Axios instance (interceptors auth)
│   │   │
│   │   ├── 📁 services/                        # API client wrappers
│   │   │   ├── tickets.service.js              # getAll(), create(), getCategories()
│   │   │   ├── workOrders.service.js           # CRUD OT
│   │   │   ├── inventory.service.js            # Stock queries
│   │   │   └── ...
│   │   │
│   │   ├── 📁 pages/                           # Route components
│   │   │   ├── LoginPage.jsx                   # Auth
│   │   │   ├── TicketsPage.jsx                 # CRUD Tickets (legacy)
│   │   │   ├── TicketsPageNew.jsx              # Nuevas categorías dinámicas
│   │   │   ├── TicketDetailPage.jsx            # Vista detalle + timeline
│   │   │   ├── WorkOrdersPage.jsx              # Grid OT
│   │   │   ├── WorkOrderExecutionPage.jsx      # Móvil para técnicos
│   │   │   ├── InventarioPage.jsx              # Stock management
│   │   │   ├── engineering/
│   │   │   │   └── EngineeringBoardPage.jsx    # Kanban de tareas
│   │   │   └── ...
│   │   │
│   │   ├── 📁 components/                      # Componentes reutilizables
│   │   │   ├── tickets/
│   │   │   │   ├── CreateTicketDialog.jsx      # Modal dinámico con categorías API
│   │   │   │   ├── wizards/                    # Wizards específicos por tipo
│   │   │   │   │   ├── TechnicalWizard.jsx    # Búsqueda conexión + diagnóstico
│   │   │   │   │   ├── InstallationWizard.jsx # Alta de servicio
│   │   │   │   │   ├── WithdrawalWizard.jsx   # Baja con motivos
│   │   │   │   │   ├── RelocationWizard.jsx   # Mudanza (origen→destino)
│   │   │   │   │   └── AdministrativeWizard.jsx # Trámites admin
│   │   │   │   └── TicketTimeline.jsx         # Bitácora unificada
│   │   │   ├── ui/                             # Shadcn/ui wrapper components
│   │   │   │   ├── dialog.jsx                  # Modal personalizado
│   │   │   │   ├── button.jsx, input.jsx, etc.
│   │   │   ├── workorders/
│   │   │   │   ├── WorkOrderGrid.jsx           # Tabla de OTs
│   │   │   │   └── WorkOrderExecution.jsx      # Móvil: timer, diagnóstico, materiales
│   │   │   └── ...
│   │   │
│   │   ├── 📁 context/                         # React Context
│   │   │   ├── AuthContext.jsx                 # Token, user, login/logout
│   │   │   └── ...
│   │   │
│   │   ├── 📁 lib/                             # Utilidades
│   │   │   ├── utils.js                        # Helpers CSS, date parsing, etc.
│   │   │   └── ...
│   │   │
│   │   ├── App.jsx                             # Root component + router
│   │   ├── main.jsx                            # Entry point
│   │   └── index.css                           # Tailwind imports
│   │
│   ├── tests/                                  # Playwright E2E
│   │   ├── tickets.e2e.spec.ts                 # Tests creación de tickets
│   │   ├── tickets-advanced.e2e.spec.ts        # Tests wizards, validaciones
│   │   ├── helpers/
│   │   │   └── login.ts                        # Setup auth para tests
│   │   └── docker-compose.e2e.yml              # Compose para E2E
│   │
│   ├── package.json                            # Dependencias Node
│   ├── vite.config.js                          # Proxy /api al backend
│   ├── tailwind.config.js                      # Dark mode, extend theme
│   ├── Dockerfile                              # Node 22 Alpine
│   └── ...
│
├── 📁 beholder_frontend/                       # Dashboard legacy (React, deprecated)
│   ├── src/                                    # Estructura similar a frontend/
│   ├── Dockerfile
│   └── ...
│
├── 📁 nginx/                                   # Configuración Nginx
│   ├── default.conf                            # Proxy rules
│   └── login-test.html                         # Test HTML
│
├── 📁 docs/                                    # Documentación técnica
│   ├── ARCHITECTURE_DECISIONS.md               # ADRs (Architecture Decision Records)
│   ├── AUTH_SYSTEM.md                          # Flujo JWT + API Keys
│   ├── BASE_DATOS.md                           # Schema documentation
│   ├── MODULO_INVENTARIO.md                    # Stock logic
│   ├── FEATURE_TIMELINE_LIVE_STATUS.md         # Timeline unificada
│   ├── checkpoints/                            # Histórico de cambios
│   └── adr/                                    # Decisions
│
├── 📁 data/                                    # Volúmenes Docker
│   ├── certbot/                                # Let's Encrypt certificates
│   └── postgres_data/                          # PostgreSQL persistent storage
│
├── .env.example                                # Variables de entorno
├── docker-compose.yml                          # Orquestación principal
├── docker-compose.e2e.yml                      # Override para tests
├── Dockerfile                                  # (deprecated, usar docker-compose)
└── README.md
```

---

## 🗄️ Modelo de Datos

### Diagrama Relacional (Conceptual)

```
Users (Usuarios)
  ├─ has many: Roles (N:N via FK)
  ├─ has many: Tickets (FK creator_id, assigned_to_id)
  ├─ has many: WorkOrders (FK assigned_to_id)
  ├─ has many: AuditLogs (FK user_id)
  └─ has one: Warehouse (FK for MOBILE type)

Roles (Roles)
  └─ has many: Users

Tickets (Incidentes técnicos)
  ├─ FK: creator_id → Users
  ├─ FK: assigned_to_id → Users (técnico asignado, nullable)
  ├─ FK: category_id → TicketCategory
  ├─ FK: connection_id → Connections (ISPCube sync)
  ├─ has many: TicketEvents (timeline unificada)
  ├─ has many: TicketAttachments
  ├─ has many: WorkOrders (cascade) - "Una falla genera OT"
  └─ has many: Tags (N:N)

TicketCategory (Categorías dinámicas)
  ├─ Tipos: technical, installation, withdrawal, relocation, administrative
  └─ has many: TicketReason (motivos dependientes)

TicketReason (Motivos por categoría)
  ├─ FK: category_id → TicketCategory
  └─ is_active: booleano

TicketTimeline / TicketEvents (Bitácora unificada)
  ├─ FK: ticket_id → Tickets (cascade)
  ├─ event_type: note | alert | ot_event | status_change | file
  ├─ created_by_id → Users (quién generó el evento)
  ├─ data: JSONB (flexible, según tipo de evento)
  └─ timestamp

WorkOrders (Órdenes de trabajo)
  ├─ FK: ticket_id → Tickets (ON DELETE CASCADE)
  ├─ FK: technician_id → Users (técnico, legacy)
  ├─ FK: team_id → Teams (asignación a equipo, no usuario individual)
  ├─ status: pending_planning | coordinated | scheduled | assigned | in_progress | completed | failed
  ├─ type: repair | install | pickup | infrastructure
  ├─ scheduled_start: datetime (UTC)
  ├─ scheduled_end: datetime (UTC, calculado)
  ├─ estimated_duration: minutos (default 60)
  ├─ coordination_notes: texto (ej: "Llave en portería")
  ├─ has many: WorkOrderItems (materiales consumidos)
  ├─ has many: TicketTimeline (eventos OT)
  ├─ resolution_type: success | failed | rescheduled | partial
  ├─ resolution_category: infrastructure | equipment | configuration
  └─ custom_data: JSONB (datos dinámicos por tipo)

WorkOrderItem (Detalle de consumo)
  ├─ FK: work_order_id → WorkOrders
  ├─ FK: product_id → Products
  ├─ quantity: cantidad usada
  ├─ actual_cost: costo real
  └─ consumed_at: timestamp

Connections (Conexiones ISPCube)
  ├─ external_id: string (ID ISPCube)
  ├─ FK: customer_id → Customers (ISPCube sync)
  ├─ service_type: PPPoE | Fibra | Wireless
  ├─ status: active | suspended | terminated
  ├─ has many: Tickets
  └─ last_sync: timestamp

Warehouses (Depósitos/Almacenes)
  ├─ type: CENTRAL | MOBILE | VIRTUAL
  ├─ FK: user_id → Users (si type=MOBILE, técnico asignado)
  ├─ has many: StockBulk (materiales a granel)
  ├─ has many: SerialItems (equipos con serial)
  └─ has many: StockMovements (auditoria)

Products (Catálogo)
  ├─ sku: identificador único
  ├─ type: SERIALIZED | BULK
  ├─ category: Cableado | Equipos | Conectores | etc.
  ├─ min_stock_alert: número mínimo antes de alerta
  └─ has many: StockBulk | SerialItems

StockBulk (Stock a granel)
  ├─ FK: warehouse_id → Warehouses
  ├─ FK: product_id → Products
  ├─ quantity: cantidad disponible
  └─ last_movement: timestamp

SerialItem (Equipos con serial)
  ├─ FK: warehouse_id → Warehouses
  ├─ FK: product_id → Products
  ├─ serial: string único
  ├─ mac: dirección MAC (si aplica)
  ├─ status: NEW | USED | DAMAGED | INSTALLED
  └─ installation_date: fecha de instalación en campo

StockMovement (Auditoría de movimientos)
  ├─ FK: product_id → Products
  ├─ type: PURCHASE | TRANSFER | CONSUMPTION | RECOVERY | ADJUSTMENT
  ├─ from_warehouse_id → Warehouses
  ├─ to_warehouse_id → Warehouses
  ├─ quantity: cantidad movida
  ├─ FK: work_order_id → WorkOrders (si type=CONSUMPTION)
  ├─ created_by_id → Users
  └─ timestamp

Teams (Equipos - Coordinación en desarrollo)
  ├─ name: string (Equipo Técnicos, Equipo Infraestructura, etc.)
  ├─ has many: Users (N:N)
  ├─ has many: WorkOrders (asignación a equipo)
  └─ calendar: JSONB (turnos, vacaciones)

EngineeringTask (Tareas del módulo NOC)
  ├─ status: todo | in_progress | done
  ├─ priority: low | medium | high | critical
  ├─ FK: assigned_to_id → Users
  ├─ FK: related_ticket_id → Tickets (opcional)
  ├─ has many: TaskTimeline (comentarios, cambios)
  └─ custom_data: JSONB

AuditLog (Bitácora de auditoría)
  ├─ FK: user_id → Users
  ├─ action: CREATE | UPDATE | DELETE | LOGIN | EXPORT
  ├─ resource_type: Ticket | WorkOrder | User | etc.
  ├─ resource_id: ID del recurso modificado
  ├─ changes: JSONB (before/after diff)
  ├─ ip_address: para rastreo
  └─ timestamp

APIKey (Claves para integraciones)
  ├─ name: identificador (ej: "ISPCube Sync")
  ├─ key: hash de la clave
  ├─ FK: user_id → Users (quién creó)
  ├─ is_active: booleano
  ├─ last_used: timestamp
  └─ expires_at: nullable
```

### Enums Clave

**TicketStatus:**
- `open` - Recién creado
- `in_progress` - Técnico trabajando
- `pending` - Aguardando acción
- `pending_infra` - Aguardando ingeniería
- `waiting_internal` - Esperando acción interna
- `attention_required` - Ingeniería completó, requiere supervisión
- `resolved` - Solucionado
- `closed` - Archivado

**TicketType (Flujos):**
- `technical` - Soporte/reclamo técnico
- `installation` - Alta de servicio
- `withdrawal` - Baja de servicio
- `relocation` - Mudanza
- `administrative` - Gestión administrativa

**WorkOrderStatus:** (actualizado para coordinación)
- `pending_planning` - Aguardando asignación del planificador
- `coordinated` - Fecha pactada con cliente, SIN cuadrilla
- `scheduled` - Fecha pactada Y cuadrilla asignada
- `assigned` - Asignada a técnico individual (legacy)
- `in_progress` - Técnico trabajando en sitio
- `completed` - Finalizada
- `failed` - Falló

**WorkOrderType:**
- `repair` - Diagnóstico/reparación
- `install` - Instalación
- `pickup` - Retiro de equipo
- `infrastructure` - Cuadrilla de infra

---

## 📱 Módulos Funcionales

### 1️⃣ Módulo de Tickets (MVPV2 - Completado)

**Estado:** ✅ Producción

**Características:**
- ✅ 5 flujos dinámicos (Technical, Installation, Withdrawal, Relocation, Administrative)
- ✅ Categorías y motivos cargadas desde BD (no hardcoded)
- ✅ Asunto generado automáticamente según motivo
- ✅ Timeline unificada (notas, alertas, eventos OT, cambios de estado)
- ✅ Adjuntos (archivos, imágenes)
- ✅ Búsqueda por DNI/nombre de cliente (integración ISPCube)
- ✅ E2E tests (59 tests, 81% pass rate)

**Stack:**
- Backend: `ticket_service.py`, rutas `tickets.py`, modelos `tickets.py`
- Frontend: `CreateTicketDialog.jsx`, 5 wizards específicos, `TicketTimeline.jsx`

**Flujos:**

| Flujo | Propósito | Validaciones | Outcome |
|-------|-----------|--------------|---------|
| **Technical** | Reclamo técnico / diagnostico | Conexión cliente obligatoria | Genera WorkOrder repair |
| **Installation** | Alta de servicio | Contacto + dirección | Genera WorkOrder install |
| **Withdrawal** | Baja de servicio | Motivo (precio/técnico/otro) | Genera WorkOrder pickup |
| **Relocation** | Mudanza | Dirección origen + destino | Genera 2 WorkOrders (pickup+install) |
| **Administrative** | Trámites admin | Motivo (facturación/data/etc.) | Puede NO generar OT |

**Regla de Negocio:** 
> "Toda baja (withdrawal) genera automáticamente una OT de retiro (pickup)"

---

### 2️⃣ Módulo de Inventario (MVPV1 - Completado)

**Estado:** ✅ Producción (básico)

**Características:**
- ✅ Almacenes (Central, Móvil/Camionetas, Virtual)
- ✅ Productos serializados (ONUs, routers con MAC) y a granel (cable, conectores)
- ✅ Stock real por almacén con alertas de mínimo
- ✅ Movimientos auditados (compra, traspaso, consumo, recupero)
- ✅ CRUD productos con categorías
- ✅ Consumo automático en WorkOrder

**Stack:**
- Backend: `inventory_service.py`, rutas `inventory.py`, modelos `inventory.py`
- Frontend: `InventarioPage.jsx`, `ProductCatalog.jsx`

**Flujo:**
1. Admin carga productos (SKU, tipo, cantidad mínima)
2. Stock por almacén se sincroniza
3. Al crear WorkOrder, consumo se deduce automáticamente
4. Alerta si cae bajo mínimo

---

### 3️⃣ Módulo de Órdenes de Trabajo (MVPV1 - En Mejora)

**Estado:** ⚠️ Producción pero requiere refactor

**Características:**
- ✅ CRUD OT (create, read, update, delete)
- ✅ Estados: pending_planning → assigned → in_progress → completed
- ✅ Asignación por equipo (Teams), no usuario individual
- ✅ Ejecución móvil con cronómetro (para técnicos en campo)
- ✅ Captura de materiales consumidos
- ⚠️ Formulario de resolución (success/failed/partial)
- ⚠️ Timeline de OT (comentarios, cambios de estado)

**Stack:**
- Backend: `work_order_service.py`, rutas `work_orders.py`, modelos `tickets.py`
- Frontend: `WorkOrdersPage.jsx`, `WorkOrderExecutionPage.jsx` (móvil)

**Regla Clave:**
> "Las OT se asignan a Teams (equipos), no a usuarios individuales. El equipo distribuye internamente."

---

### 4️⃣ Módulo de Ingeniería/NOC (MVPV1 - Completado)

**Estado:** ✅ Producción

**Características:**
- ✅ Kanban visual (todo → in_progress → done)
- ✅ Tareas con prioridad y asignación
- ✅ Timeline de tareas (comentarios, cambios)
- ✅ Vinculación con Tickets (si aplica)
- ✅ Estado en vivo (colores, etiquetas)

**Stack:**
- Backend: `engineering_service.py`, rutas `engineering.py`, modelos `engineering.py`
- Frontend: `EngineeringBoardPage.jsx` (Kanban), `EngineeringTimelineView.jsx`

**Uso:**
- Planificadores de infraestructura usan para tareas de NOC (cambios, upgrades, mantenimiento)
- Técnicos ven tareas asignadas a su equipo

---

### 5️⃣ Módulo de Coordinación (✅ MVP Completado - Q1 2026)

**Estado:** ✅ Producción - MVP v1.0 completo

**Versión:** 1.0 | Última actualización: 2 Febrero 2026

**Características Implementadas:**
- ✅ Teams/Cuadrillas con gestión completa de miembros
- ✅ CRUD funcional (create, read, update, delete) con endpoints v2/coordination/teams
- ✅ Asignación de móviles (warehouse type=MOBILE) a equipos con validación
- ✅ Gestión de roles por miembro (technician/leader) con UI inline
- ✅ Prevención de asignaciones duplicadas (bilocación) - técnico no puede estar en múltiples equipos
- ✅ Prevención de asignaciones duplicadas (móviles) - cada móvil asignado a máximo 1 equipo
- ✅ UI inteligente con selects de vehicles y usuarios filtrados dinámicamente
- ✅ Enforcing single leader per team con confirmación de cambio
- ✅ Avatar component reutilizable en toda la app (initials, 5 tamaños, 4 variantes de color)
- ✅ Dropdowns mostran name+ID, nunca solo ID
- ✅ Buttons X de eliminar miembro correctamente alineados (padding y spacing optimizado)
- ✅ Color coding visual: Técnico=Emerald 💚 | Líder=Cyan 💎 (no rojo para evitar "desactivado")

**Database Schema:**
```
Teams (equipo de técnicos)
  ├─ id: Primary Key
  ├─ name: string (nombre cuadrilla)
  ├─ vehicle_id: FK → Warehouses (type=MOBILE, nullable)
  ├─ is_active: boolean
  └─ has many: TeamMembers

TeamMembers (miembros del equipo)
  ├─ id: Primary Key
  ├─ team_id: FK → Teams (cascade delete)
  ├─ user_id: FK → Users
  ├─ role: enum [technician, leader] - solo 1 líder por team
  └─ joined_at: timestamp
```

**Características Planeadas (Q2 2026+):**
- [ ] Calendario de turnos y vacaciones
- [ ] Integración con WorkOrders (asignar OT a equipos)
- [ ] Distribución automática de OT por carga de equipo
- [ ] Notificaciones (app mobile, SMS, push)
- [ ] Reportes de ocupación y utilización
- [ ] Validación de capacidad (máx 2 técnicos por móvil)
- [ ] Geolocalización de equipos en tiempo real

**Stack Técnico:**

**Backend:**
- Router: `routers/v2/coordination.py`
- Service: `services/coordination_service.py` con métodos:
  - `get_teams(db, active_only=True)`
  - `create_team(db, payload)`
  - `update_team(db, team_id, payload)`
  - `delete_team(db, team_id)`
  - `add_team_member(db, team_id, user_id, role="technician")`
  - `remove_team_member(db, team_id, user_id)`
  - `update_member_role(db, team_id, user_id, new_role)` - con validación single leader
- Models: `models/coordination.py`
- Endpoints:
  - `GET /v2/coordination/teams` - listar con filtro active
  - `POST /v2/coordination/teams` - crear
  - `PUT /v2/coordination/teams/{id}` - editar
  - `DELETE /v2/coordination/teams/{id}` - borrar
  - `POST /v2/coordination/teams/{id}/members` - agregar miembro
  - `DELETE /v2/coordination/teams/{id}/members/{user_id}` - remover miembro
  - `PUT /v2/coordination/teams/{id}/members/{user_id}/role` - cambiar rol con validación

**Frontend:**
- Page: `pages/coordination/CuadrillasPage.jsx` (326 lines)
  - Orquesta loading de teams, users (filtrados por rol 'técnico'), vehicles (MOBILE)
  - Mantiene Set-based filtering para prevenir duplicados
  - Calcula: assignedVehicleIds, assignedUserIds, availableUsers, availableVehicles
  - Handlers: handleCreateTeam, handleEditTeam, handleDeleteTeam
- Card: `components/coordination/TeamCard.jsx` (260+ lines)
  - Muestra info equipo con lista de miembros
  - Inline role selector con confirmación para cambio a líder
  - Color coding: technician=emerald-600, leader=cyan-600
  - Buttons X compactados (h-5 w-5, icons h-3.5 w-3.5)
  - Remove member action con confirmación
- Dialog: `components/coordination/CreateTeamDialog.jsx` (170 lines)
  - Form: name (required), vehicle (select con name+ID), initial_member (select con full_name+ID), is_active
  - Crea team y opcionalmente agrega primer miembro con rol technician
  - Props: availableUsers, availableVehicles (pre-filtrados desde page)
- Dialog: `components/coordination/EditTeamDialog.jsx` (144 lines)
  - Form: name, vehicle (select), is_active
  - Carga datos via useEffect
  - Props: team, availableVehicles
- Dialog: `components/coordination/AddMemberDialog.jsx` (143 lines)
  - Form: user (select), role (radio o select)
  - Props: availableUsers (filtrados para no duplicar)
- Component: `components/ui/Avatar.jsx` (NEW - 76 lines)
  - Reusable en toda app
  - Props: name, email, image, size (xs/sm/md/lg/xl), variant (emerald/amber/ruby/zinc)
  - Muestra imagen o initials
  - Tooltip con name+email
  - Used in: TeamCard, SettingsPage users table
- Service: `services/coordination.service.js` (200+ lines)
  - Methods: getTeams(), createTeam(), updateTeam(), deleteTeam()
  - Methods: addTeamMember(), removeTeamMember(), updateMemberRole()
  - Method: getUserTeams(userId)

**Reglas de Negocio (Enforcement):**
1. **Single Leader:** Solo 1 líder por equipo. Si cambias someone a leader y ya hay uno, muestra confirmación y demota al anterior automáticamente.
2. **No Bilocación:** Técnico solo puede estar en 1 equipo. Dropdown availableUsers filtra todos los user_ids en assignedUserIds.
3. **Móvil Exclusivo:** Cada móvil en 1 equipo. availableVehicles excluye asignados, excepto el actual en edit.
4. **Color UI:** Técnico=Emerald (confianza), Líder=Cyan (autoridad), nunca rojo (no se ve como "error")

**Testing:**
- Manual testing via http://emerald.2finternet.ar/app/cuadrillas ✅
- CRUD operations funcionales ✅
- Filtering logic validated ✅
- Role enforcement tested ✅
- Pending: E2E automation tests (deferred to Q2)

---

### 6️⃣ Módulo Beholder (Legacy - Deprecated)

**Estado:** ⚠️ Legacy (en deuda técnica)

**Propósito Original:**
- Monitor diagnóstico de red (desde ISPCube)
- Alertas de infraestructura

**Nota:** 
> Funcionalidad replicada en módulo Engineering. Se recomienda deprecar en futuro.

---

## ⚙️ Reglas de Negocio Clave

### Ciclo de Vida de Ticket

```
[Nuevo]
  ↓
[Técnico asignado]
  ↓ (comienza diagnóstico)
[En Progreso]
  ├─→ [Resuelto] ─→ [Cerrado]
  ├─→ [Pendiente] (aguarda cliente, proveedor, etc.)
  └─→ [Escalado a Ingeniería]
```

### Creación de Órdenes de Trabajo

**Regla Principal:**
> "Una baja (Withdrawal) SIEMPRE genera automáticamente una WorkOrder de tipo `pickup`."

**Proceso:**
1. Usuario crea Ticket de tipo `withdrawal`
2. Sistema detecta automáticamente en `ticket_service.py`
3. Crea WorkOrder con:
   - `type: "pickup"`
   - `status: "pending_planning"`
   - Vinculado al Ticket original
4. Planificador asigna equipo → WorkOrder pasa a `assigned`
5. Técnico ejecuta → pasa a `in_progress`
6. Completa y sube foto de retiro → `completed`

### Asignación de Órdenes de Trabajo

**No es 1-to-1 (usuario):**
- OT se asigna a **Teams**, no usuarios individuales
- El Team internamente distribuye entre sus técnicos
- Permite redistribución dinámica si alguien se enferma/va de vacaciones

**Flujo:**
1. Planificador crea OT y la asigna a Team A
2. Team A ve OT en su backlog
3. Team lead asigna a técnico específico
4. Técnico recibe notificación y comienza ejecución

### Consumo Automático de Stock

**Cuando se completa una WorkOrder:**
1. Backend itera cada `WorkOrderItem`
2. Deduce cantidad del Warehouse móvil del técnico
3. Genera `StockMovement` (auditoria)
4. Si cae bajo mínimo, alerta al almacenero

### Timeline Unificada

**Un único stream de eventos por Ticket:**
- Notas del operador
- Alertas del sistema
- Cambios de estado
- Eventos de OT (asignación, inicio, fin)
- Adjuntos

**Ventaja:** No hay que navegar múltiples tabs/tablas. Todo en un timeline.

### Categorías Dinámicas

**No son hardcoded:**
1. Admin define categorías en BD (TicketCategory)
2. Cada categoría tiene motivos asociados (TicketReason)
3. Frontend lista categorías via API (`GET /categories`)
4. Al seleccionar categoría → carga motivos relacionados
5. Seleccionar motivo → genera automáticamente asunto

**Ejemplo:**
```
Categoría: "Falla Técnica"
  Motivos:
    - Sin conexión (genera asunto: "Cliente reporta sin conexión")
    - Intermitente (genera asunto: "Servicio intermitente")
    - Lento (genera asunto: "Conexión lenta")
```

### Autenticación & Autorización

**JWT + API Keys:**

```
Login (usuario/password) 
  ↓
Backend genera JWT + Refresh Token
  ↓
Frontend almacena en memoria + localStorage
  ↓
Cada request lleva JWT en header Authorization: Bearer <token>
  ↓
Backend valida firma JWT
```

**Para integraciones (bots):**
- API Key en header `x-api-key`
- Backend valida contra tabla `APIKey`
- Audita IP + timestamp de uso

**Roles & Permisos:**
- Rol define array de permisos (ej: `["ticket.create", "ticket.read"]`)
- Middleware verifica que user tenga permiso antes de ejecutar endpoint

---

## 🏗️ Patrones Arquitectónicos

### 1. Service Layer

**Propósito:** Separar lógica de negocio de endpoints

**Estructura:**
```python
# routers/tickets.py (endpoint)
@router.post("/tickets", response_model=TicketResponse)
async def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    return await ticket_service.create_ticket(db, payload)

# services/ticket_service.py (lógica)
async def create_ticket(db: Session, payload: TicketCreate):
    # Validaciones
    if not payload.connection_id:
        raise ValueError("Connection required for technical ticket")
    
    # Crear ticket
    ticket = Ticket(...)
    db.add(ticket)
    db.commit()
    
    # Efectos secundarios
    if payload.ticket_type == "withdrawal":
        await create_work_order(db, ticket)  # Regla de negocio
    
    return ticket
```

**Beneficios:**
- Fácil testear (sin dependencias HTTP)
- Lógica reutilizable entre endpoints
- Cambios centralizados

### 2. Repository Pattern (Cuando Aplique)

**Para queries complejas:**
```python
# db/ticket_repository.py
class TicketRepository:
    @staticmethod
    def get_open_by_customer(db: Session, customer_id: int):
        return db.query(Ticket)\
            .join(Connection)\
            .filter(Ticket.status == "open")\
            .filter(Connection.customer_id == customer_id)\
            .all()

# En service
def get_customer_tickets(db, customer_id):
    return TicketRepository.get_open_by_customer(db, customer_id)
```

### 3. Event-Driven Timeline

**Patrón: Cada cambio genera un evento**

```python
# Cuando cambia estado de ticket
ticket.status = "resolved"
db.add(ticket)
db.flush()  # Guardar transacción pending

# Crear evento
event = TicketEvent(
    ticket_id=ticket.id,
    event_type="status_change",
    data={"old_status": "in_progress", "new_status": "resolved"},
    created_by_id=user_id
)
db.add(event)
db.commit()

# Frontend se suscribe con WebSocket o polling
# Recibe evento y actualiza timeline en tiempo real
```

### 4. Flexible Schema con JSONB

**Para datos que varían por tipo de ticket:**

```python
# tickets.py
custom_data: Mapped[Optional[dict]] = mapped_column(
    JSONB,
    nullable=True,
    comment="Datos flexibles según ticket_type"
)

# Al crear withdrawal
ticket.custom_data = {
    "reason": "customer_request",
    "contact_phone": "+5491123456789",
    "equipment_to_pickup": ["router", "onu"]
}
```

**Ventaja:** Sin migración cuando se agrega un nuevo campo.

### 5. Lazy Loading + Eager Loading Optimizado

**SQLAlchemy 2.0 con selectinload:**

```python
from sqlalchemy.orm import selectinload

# Query lenta (N+1)
tickets = db.query(Ticket).all()
for t in tickets:
    print(t.work_orders)  # Query adicional por c/ticket

# Query optimizada
tickets = db.query(Ticket)\
    .options(selectinload(Ticket.work_orders))\
    .all()  # Una sola query con JOIN
```

### 6. Paginación Estándar

```python
# GET /v2/tickets?limit=20&offset=40
from sqlalchemy import func

def get_paginated(db: Session, limit: int = 20, offset: int = 0):
    total = db.query(func.count(Ticket.id)).scalar()
    items = db.query(Ticket).limit(limit).offset(offset).all()
    
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }
```

### 7. Soft Delete (Archivado Lógico)

**En lugar de borrar, marcar como inactivo:**

```python
class Ticket(Base):
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, index=True
    )

# Query siempre filtra
db.query(Ticket).filter(Ticket.is_deleted == False)

# O en base class mixin
class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
```

### 8. Rate Limiting

**Para API pública:**

```python
# models/audit.py
class RateLimit(Base):
    api_key_id: FK
    endpoint: string
    requests_in_window: int
    reset_at: datetime

# middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.headers.get("x-api-key"):
        check_rate_limit(request)
    return await call_next(request)
```

---

## 🔐 Seguridad

### Password Hashing
- **Algoritmo:** Argon2 (via `passlib`)
- **Never:** almacenar en plain text
- **Hashing:** en `user_service.py` al crear/resetear

### JWT Tokens
- **Claims:** user_id, email, exp (expiración)
- **Secret:** desde env variable `SECRET_KEY`
- **Refresh:** token de larga duración para renovar sin re-login

### CORS
- Configurado en `main.py`
- `allow_origins: ["*"]` en desarrollo
- En producción: whitelist explícita

### SQL Injection Prevention
- SQLAlchemy ORM: parámetros bindeados automáticamente
- Nunca usar f-strings en queries SQL

### Auditoría
- Tabla `AuditLog` registra create/update/delete
- IP address y timestamp para forensics
- Diff before/after en JSON

---

## 📊 Métricas & Monitoreo

### Logs Centralizados
- **Backend:** Loguru (stdout a Docker logs)
- **Frontend:** Console + Sentry (opcional)
- **DB:** PostgreSQL logs

### Healthchecks
```yaml
# docker-compose.yml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### Errores Comunes

| Error | Causa | Fix |
|-------|-------|-----|
| 404 /api/v2/tickets | Proxy Vite mal configurado | Revisar `INTERNAL_API_URL` en docker-compose |
| 401 Unauthorized | JWT expirado | Usar refresh token |
| 422 Unprocessable Entity | Schema Pydantic inválido | Validar payload con swagger |
| 500 Internal Server Error | Query SQL fallida | Ver logs backend |

---

## 🚀 Deployment

### Ambientes

**Desarrollo:**
```bash
docker-compose up -d
# Puerto 5173 (frontend), 8500 (backend), 80 (nginx)
```

**Producción:**
- Nginx reverse proxy con SSL (Let's Encrypt)
- PostgreSQL en volumen persistente
- Celery worker para tareas async
- Redis para caché y broker

**CI/CD:**
- GitHub Actions (si configura)
- Build de imágenes Docker
- Push a registry

---

## 📚 Referencias Rápidas

### Crear un Nuevo Endpoint

```python
# 1. Schema (schemas/mi_modulo.py)
from pydantic import BaseModel

class MiItemCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class MiItemResponse(MiItemCreate):
    id: int
    created_at: datetime

# 2. Service (services/mi_service.py)
async def create_item(db: Session, payload: MiItemCreate):
    item = MiItem(nombre=payload.nombre, ...)
    db.add(item)
    db.commit()
    return item

# 3. Router (routers/mi_modulo.py)
from fastapi import APIRouter

router = APIRouter(prefix="/mi-items", tags=["Mi Módulo"])

@router.post("", response_model=MiItemResponse)
async def create(payload: MiItemCreate, db: Session = Depends(get_db)):
    return await mi_service.create_item(db, payload)

# 4. Registrar en main.py
app.include_router(mi_router)
```

### Agregar Migración

```bash
# En backend/
cd backend
alembic revision --autogenerate -m "Agregar campo X a tabla Y"
# Editar alembic/versions/xxxxx_mensaje.py si necesita ajustes
alembic upgrade head
```

### Testear Endpoint

```bash
curl -X POST http://localhost:8500/api/v2/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"subject":"Test","connection_id":1,...}'
```

---

## 🔗 Enlaces Útiles

- **Documentación FastAPI:** https://fastapi.tiangolo.com
- **SQLAlchemy 2.0:** https://docs.sqlalchemy.org/en/20/
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Playwright E2E:** https://playwright.dev

---

**Documento generado: 30 de Enero 2026**  
**Revisado por:** Arquitectura Emerald ERP  
**Próxima revisión:** 15 de Febrero 2026
