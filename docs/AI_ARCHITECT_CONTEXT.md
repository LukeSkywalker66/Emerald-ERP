# 🤖 AI Architect Context - Emerald ERP

**Versión:** 2026-06-02  
**Audiencia:** IAs, LLMs, Agentes de Codificación  
**Propósito:** Contexto completo para mantener arquitectura, tomar decisiones y contribuir

---

## 📋 Identidad del Proyecto

**Nombre:** Emerald ERP  
**Tipo:** Sistema de Gestión Integral para ISP (Argentina)  
**Stack:** Python (FastAPI) + React (Vite) + PostgreSQL 15  
**Hosting:** Docker Compose (auto-deployable)  
**Licencia:** Propietaria (LukeSkywalker66)

---

## 🏗️ Decisiones Arquitectónicas Clave

### 1. Backend: FastAPI + SQLAlchemy 2.0 (Mapped[], mapped_column())
**Decisión:** Clean Slate pattern para tipo-seguridad y autodocumentación  
**Implicaciones:**
- ✅ Validación automática Pydantic
- ✅ Migraciones versionadas con Alembic
- ✅ JSON schemas generados automáticamente
- ❌ Stricto: NO usar sintaxis vieja `Column()`, SIEMPRE `mapped_column()`

**Ejemplo correcto:**
```python
class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    vehicle_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
```

### 2. Frontend: React 19 + Vite (no bundler legacy)
**Decisión:** SPA moderna con HMR (hot module reload)  
**Implicaciones:**
- ✅ Build time: ~9 segundos
- ✅ Bundle size: <1 MB gzipped
- ✅ Dev server instantáneo
- ❌ Sin webpack config (usar Vite nativo)

### 3. Base de Datos: PostgreSQL 15 Alpine (no MySQL)
**Decisión:** Features JSONB, UUID, arrays, enums nativos  
**Implicaciones:**
- ✅ Datos semiestructurados vía JSONB (ticket metadata, diagnosis)
- ✅ Auditoría con triggers
- ❌ No transacciones distribuidas (monolith)

### 4. Modularidad: Clean Slate por módulo nuevo
**Decisión:** Cada módulo (Fleet, Inventory, Coordination) es independiente  
**Implicaciones:**
- ✅ Router `/api/v2/{module}`
- ✅ Models en `backend/src/models/{module}.py`
- ✅ Schema validación en `backend/src/schemas/{module}.py`
- ❌ NO mezclar legacy (Beholder) con nuevos diseños

### 5. Monitoreo de Servicios: Strategy Pattern (NEW 25/05/2026)
**Decisión:** Monitoring Engine usa Strategy Pattern con checkers intercambiables  
**Implementación:**
- `BaseChecker` (abstracto) → `PingChecker | HttpChecker | TcpChecker | SslChecker`
- `CheckerFactory` crea el checker según `monitor_type`
- `MonitoringOrchestrator` orquesta ejecución y logging
- **Implicaciones:**
  - ✅ Fácil agregar nuevo checker (heredar BaseChecker)
  - ✅ Cada checker tiene su propia lógica de timeout/error
  - ✅ Resultados históricos en `monitor_check_history` (JSONB)
  - ❌ No usar raw subprocess para checkers (siempre usar stdlib/httpx)

### 6. Scheduled Tasks: Configuración Persistente (NEW 25/05/2026)
**Decisión:** Celery Beat schedule se construye dinámicamente desde DB  
**Implementación:**
- Tabla `scheduled_tasks` con schedule_config (JSONB: cron o interval)
- Al iniciar Celery, `beat_schedule` se genera desde DB
- UI permite activar/desactivar y modificar schedules sin redeploy
- **Implicaciones:**
  - ✅ Sin hardcodeo de schedules en código
  - ✅ Historial de ejecuciones visible desde UI
  - ✅ Trigger manual disponible

### 7. Multi-entorno Frontend (NEW 28/05/2026)
**Decisión:** `VITE_APP_ENV` define el entorno en build-time  
**Implementación:**
- `VITE_APP_ENV=development|staging|production`
- Docker Compose separados: `docker-compose.dev.yml`, `.staging.yml`
- Nginx config por entorno
- **Implicaciones:**
  - ✅ Build único para cada entorno
  - ✅ Variables de entorno en `.env` raíz
  - ❌ No mezclar configs de distintos entornos

### 8. Geolocalización: Server-side parsing (NEW 21/05/2026)
**Decisión:** El parsing de URLs de Google Maps se hace en backend, no frontend  
**Implementación:**
- Endpoint `GET /api/v2/work-orders/parse-map-link?url=...`
- Soportados: goo.gl, /maps/place/, /maps/search/, /maps/@lat,lng
- HTML body fallback para short links
- **Implicaciones:**
  - ✅ Frontend simplificado (solo muestra resultado)
  - ✅ URLs no canónicas se resuelven server-side
  - ✅ Logging de fallos para debugging


| Entidad | Fuente | Propietario |
|---------|--------|------------|
| Clientes, conexiones | ISPCube | Billing |
| Vehículos, coordinación | Emerald | Operaciones |
| Tickets, OT | Emerald | Support |
| Inventario | Emerald | Logística |
| Infraestructura (PPPoE, ONUs) | Mikrotik/SmartOLT | NOC |

---

## 🗺️ Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE BROWSER                                             │
│ React 19 + Vite + Tailwind CSS (Emerald Dark Mode)         │
│ ├─ pages/                 (rutas principales)              │
│ ├─ components/            (reutilizables)                  │
│ ├─ services/              (API clients)                     │
│ └─ hooks/                 (lógica compartida)              │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTPS (SSL/TLS via Let's Encrypt)
           │ Port 8500 (Nginx proxy)
┌──────────▼──────────────────────────────────────────────────┐
│ BACKEND API (FastAPI + Uvicorn)                            │
│ ├─ routers/               (endpoints grouped)              │
│ │  ├─ fleet.py           (new: vehicles)                  │
│ │  ├─ coordination.py     (teams, cuadrillas)             │
│ │  ├─ tickets_v2.py       (issues + timeline)             │
│ │  ├─ inventory.py        (stock, transfers)              │
│ │  ├─ engineering.py      (NOC, kanban)                   │
│ │  └─ ...                                                  │
│ ├─ models/                (SQLAlchemy 2.0)                │
│ │  ├─ fleet.py            (Vehicle, VehicleStatus)        │
│ │  ├─ coordination.py     (Team, TeamMember)              │
│ │  ├─ tickets.py          (Ticket, TicketTimeline)        │
│ │  ├─ work_orders.py      (WorkOrder, status machine)     │
│ │  └─ ...                                                  │
│ ├─ schemas/               (Pydantic validation)            │
│ ├─ services/              (business logic)                 │
│ └─ clients/               (external APIs)                  │
│    ├─ ispcube.py          (sync clientes/conexiones)      │
│    ├─ mikrotik.py         (PPPoe secrets)                 │
│    └─ smartolt.py         (ONUs/fibra)                    │
└──────────┬──────────────────────────────────────────────────┘
           │ TCP/IP
┌──────────▼──────────────────────────────────────────────────┐
│ POSTGRESQL 15 (Container)                                   │
│ ├─ PUBLIC schema         (tablas de negocio)              │
│ │  ├─ vehicles           (nuevo 03/02)                    │
│ │  ├─ teams              (actualizado 02/02)              │
│ │  ├─ work_orders        (actualizado 02/02)              │
│ │  ├─ tickets            (core desde inicio)              │
│ │  └─ ...                                                  │
│ └─ Indices, triggers, constraints                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujos Principales

### Flujo 1: Crear Ticket → OT → Coordinación → Ejecución
```
1. Support abre TICKET (categoría, motivo, cliente desde ISPCube)
2. Sistema crea TICKET_TIMELINE entry
3. Coordinador crea WORK_ORDER (tipo: install/repair/etc)
4. Coordinador pacta fecha (scheduled_start) → status=coordinated
5. Coordinador asigna TEAM → status=scheduled
6. Team recibe en coordinación (map grid)
7. Técnico ejecuta (work_order items consumidos from warehouse)
8. Técnico cierra → status=completed
9. WorkOrder items auditados (stock actualizado)
```

### Flujo 2: Gestionar Flota (Nuevo 03/02)
```
1. Administrador crea VEHICLE (patente, marca, modelo, año)
   - ✅ Auto-crea Warehouse MOBILE asociado
   - ✅ Status enum: ACTIVE, MAINTENANCE, RETIRED, DONATED
2. Coordinador asigna VEHICLE a TEAM (opcional)
   - team.vehicle_id = vehicle.id
3. TeamCard muestra vehicle info (modelo, patente, warehouse)
4. Team usa warehouse MOBILE para stock en ruta
5. (Futuro) Mantenimiento programado via status=MAINTENANCE
```

### Flujo 3: Sincronización Nocturna
```
1. CRON diario (00:00 UTC)
2. Sync: Clientes desde ISPCube
3. Sync: PPP secrets desde Mikrotik
4. Sync: ONUs desde SmartOLT
5. Actualizar planes, conexiones, subscribers
6. Log de cambios → auditoría
```

---

## 📊 Estado de los Módulos (03/02/2026)

| Módulo | Status | Completitud | API | Frontend | BD |
|--------|--------|-------------|-----|----------|-----|
| **Auth** | ✅ Ready | 100% | v1 | Login | users, roles |
| **Tickets v2** | ✅ Ready | 100% | v2 | Detail, Timeline | tickets, timeline |
| **WorkOrders** | ✅ Ready | 100% | v2 | Execution | work_orders, items |
| **Coordination** | ✅ Ready | 100% | v2 | Grid, Teams | teams, members |
| **Fleet** | ✅ Ready | 100% | v2 | Admin table | vehicles, (warehouse FK) |
| **Inventory** | ✅ Ready | 100% | v2 | Dashboard | warehouses, stock, movements |
| **Engineering** | ✅ Ready | 100% | v2 | Kanban, Timeline | engineering tasks |
| **Auditoría** | ✅ Ready | 100% | v2 | Monitor admin-only | audit_logs (JSONB) |
| **Integraciones** | ✅ Ready | 100% | N/A | (sync backend) | clientes, connections |

**Legend:** ✅ = Production, 🚧 = WIP, ❌ = Planned

---

## 🎯 Reglas de Contribución (Nivel NASA)

### Principios Clave
1. **Robustez > Rapidez**
   - No hacks ni workarounds
   - Si dato falta (ej: barrios), arreglalo en backend/BD, no en regex frágil en frontend

2. **Validación Strict**
   - Pydantic schemas obligatorios (no raw dict)
   - DB constraints (unique, FK, check)
   - Frontend form validation + server-side check

3. **Auditoría Completa** ⭐ NUEVO 09/03/2026
   - Motor universal: `log_create()`, `log_update()`, `log_delete()` en `backend/src/utils/audit.py`
   - 3 capas: Acción+Usuario | Entidad+ID | old_values/new_values (JSONB)
   - Try/Except safety: Fallo de audit NO rompe operación principal
   - Admin-only: API `/v2/audit-logs` con filtros (entity, action, user, status)
   - Frontend: Monitor táctico con tabla, filtros, modal JSON diff
   - 13 endpoints auditados: Inventory (6), Users (4), WorkOrders (3)

4. **Guard Rails Operativos en Calle** ⭐ NUEVO 10/03/2026
   - **Prisión del Técnico (OTs vencidas):** hard block real de agenda hasta cerrar OTs vencidas.
   - **Inspección de Vehículo (pre-trip):** action block, no blind block.
   - Permite leer OTs y preparar materiales, pero bloquea mutaciones de estado (`Iniciar`, `Completar`).
   - **Backend hardening:** `PATCH /v2/work-orders/{id}` valida inspección diaria antes de `in_progress`.
   - Respuesta esperada sin inspección: `403` con detalle: "Debe completar la inspección diaria del vehículo antes de operar.".
   - **Redundancia de cuadrilla:** la inspección diaria se valida por `vehicle_id + fecha`.
   - Si cualquier técnico de la cuadrilla la carga, se desbloquea para todos los que usan ese vehículo.
   - **Ficha clínica de móviles:** Flota expone historial por vehículo (fecha, técnico, km, estado semáforo, observaciones).

### Patrones Obligatorios

**Backend - Crear recurso:**
```python
@router.post("", response_model=ResourceResponse)
def create_resource(data: ResourceCreate, db: Session = Depends(get_db)):
    # 1. Validar datos relacionados existen
    # 2. Crear entidad
    # 3. Crear audit log
    # 4. db.commit()
    # 5. Return respuesta con ID + timestamps
```

**Frontend - Llamar API:**
```javascript
try {
  const result = await resourceService.create(payload);
  // Actualizar UI
  setItems([...items, result]);
  toast.success("Creado exitosamente");
} catch (error) {
  console.error("Error:", error.response?.data?.detail);
  toast.error("No se pudo crear");
}
```

**DB - Agregar columna:**
```bash
# ❌ NO
ALTER TABLE vehicles ADD COLUMN is_deleted BOOL;

# ✅ SÍ
alembic revision --autogenerate -m "add_is_deleted_to_vehicles"
# Revisar .py generated
alembic upgrade head
```

---

## 🚨 Troubleshooting Matrix

| Síntoma | Causa Probable | Solución |
|---------|---|---|
| 500 Backend en POST/PUT | Falta campo obligatorio en schema o DB constraint | Revisar logs `docker logs emerald_backend \| tail -20` |
| Frontend vacío (todo white) | Error en React render, check console | DevTools → Console tab |
| DB migration fail | Sintaxis SQL, ciclo circular en FKs | `alembic downgrade -1`, fix, `alembic upgrade head` |
| Stock mismatch | Transacción incompleta o sync async race | Recount manual, auditar timeline |
| Vehicle sin warehouse | Insert manualmente sin FK | (no debería pasar, handler idem) |
| Técnico no puede iniciar OT | Falta inspección diaria de vehículo | Completar `POST /api/v2/fleet/inspections` |

---

## 📈 Roadmap Próximas Fases

**Fase 7 (Completada 09/03/2026):**
- [x] ✅ Sistema de Auditoría Universal (Ojo de Dios)
- [x] ✅ Migración de 1378 registros legacy
- [x] ✅ Frontend monitor admin-only con JSON diff
- [x] ✅ Auditoría en Inventory, Users, WorkOrders
- [x] ✅ Expandido a Coordination (teams) y Fleet (vehicles) — 20/05/2026
- [x] ✅ Date filters con neon-calendar popover — 20/05/2026
- [ ] Mantenimiento programado (status=MAINTENANCE con alertas)

**Fase 8 (Completada 25/05/2026):**
- [x] ✅ Dashboard refactor — datos reales de API
- [x] ✅ Monitoring Engine — Ping/HTTP/TCP/SSL checkers
- [x] ✅ Scheduled Tasks V2 — config persistente desde DB
- [x] ✅ Settings Module — SystemConfig key-value + ServiceMonitor CRUD
- [x] ✅ Sidebar pin/collapse con hover-expand

**Fase 9 (Completada 21/05/2026):**
- [x] ✅ Geolocalización Fase 5 — lat/lng en WorkOrders
- [x] ✅ parse-map-link con Google Maps integration
- [x] ✅ Botón 'Mostrar Ubicación' en CoordinationSheet

**Fase 10 (Completada 28/05/2026):**
- [x] ✅ Multi-entorno Frontend (VITE_APP_ENV)
- [x] ✅ Docker Compose develop/staging separados
- [x] ✅ Beholder Oracle migration (frontend integrado)

**Próximas Fases:**
- [ ] 🚧 MinIO — Migración de almacenamiento de archivos a S3 (WIP)
- [ ] GPS real-time tracking de técnicos
- [ ] Mobile app (React Native) para técnicos
- [ ] Offline-first sync
- [ ] Push notifications

---

## 🎭 Lore y Estética

**"The Emerald Orchestrator"** → La máquina detrás de la cortina

- **Tema:** Cyberpunk/Tactical HUD
- **Colores:** Zinc-900 fondo, Emerald-400 principal, Ruby/Amber/Cyan estados
- **Tono:** Profesional + misterioso ("Consultando al Orquestador...")
- **Iconografía:** Lucide Icons (Truck, Package, Clock, etc.)

---

## 🔐 Seguridad (Resumen)

**Autenticación:** JWT (HS256)  
**Autorizacion:** RBAC (roles in token, checked en backend)  
**Hashing:** Argon2 (passwords)  
**CORS:** Mismo origen (Nginx proxy)  
**Rate Limiting:** 100 req/min por IP  
**Auditoría:** Tabla separada, no borrable

---

## 📞 Referencias

- **DB Schema:** [BASE_DATOS.md](BASE_DATOS.md)
- **Fleet Específico:** [FLEET_MODULE.md](FLEET_MODULE.md)
- **Auditoría:** Ver [MASTER_CONTEXT.md](MASTER_CONTEXT.md) sección 4.8
- **Status Actual:** [ESTADO_ACTUAL_2026_06_02.md](ESTADO_ACTUAL_2026_06_02.md)
- **API Docs:** `http://localhost:8500/docs` (Swagger)

---

**Última revisión:** 02 de junio de 2026  
**Mantenedor:** LukeSkywalker66  
**Retroalimentación:** Ver CONTRIBUTING.md (TBD)
