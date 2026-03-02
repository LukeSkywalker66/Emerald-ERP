# 🗺️ Roadmap Emerald ERP 2026

**Versión:** 1.0 (Consolidado)  
**Última revisión:** 2 de marzo 2026  
**Status:** Q1 ✅ COMPLETADO | Q2-Q4 🚧 PLANEADO

---

## 📋 Índice

1. Q1 2026 (Ene-Mar): Foundation Completada ✅
2. Q2 2026 (Abr-Jun): Advanced Coordinación & Fleet 🚧
3. Q3 2026 (Jul-Sep): Mobile + IA + Reportes 📋
4. Q4 2026 (Oct-Dic): Integraciones & Production Hardening 📋
5. Métricas & Health Check
6. Decisiones Arquitectónicas
7. Team Responsabilidades

---

## ✅ Q1 2026: Foundation (Completado - 02/02 a 03/02)

### Módulos Entregados

#### Auth & Users
```
✅ Sistema RBAC completo (Admin, Coordinator, Technician, Viewer)
✅ JWT autenticación + refresh tokens
✅ Session management
✅ Password reset workflow
Status: Production Ready
```

#### Tickets
```
✅ Modelo Ticket con eventos (JSONB)
✅ Estados: pending → assigned → resolved → closed
✅ Notes + attachments
✅ Integration con ISPCube (facturación)
Status: Production Ready
Commits: 27d6fe3 y anteriores
```

#### Work Orders (OT)
```
✅ Modelo WorkOrder con scheduling
✅ Estados: pending_planning → coordinated → scheduled → in_progress → completed
✅ Link a Tickets (1:N)
✅ Estimated duration + scheduler
Status: Production Ready
Latest migration: 2026_02_02_002
```

#### Coordinación Base (Completada - 02/02)
```
✅ Modelo Team (cuadrillas) con members
✅ WorkOrder ↔ Team assignment
✅ CoordinationGridPage (mapa + timeline interactivo)
✅ CuadrillasPage (CRUD teams, selector OT)
✅ TeamCard mejorada (info equipo)
Status: Production Ready
Commit: 27d6fe3 + posteriores
```

#### Fleet Operativo (Completado - 03/02)
```
✅ Modelo Vehicle (Vehículos operativos)
✅ VehicleStatus enum: ACTIVE, MAINTENANCE, RETIRED, DONATED
✅ 1:1 Vehicle ↔ Warehouse MOBILE (auto-creada)
✅ FleetPage: tabla administrativa con CRUD
✅ CreateVehicleDialog + EditVehicleDialog
✅ Vehicle ↔ Team assignment (team.vehicle_id)
✅ TeamCard enhanced: muestra vehículo (Truck icon + modelo + patente)
✅ AppSidebar: "Flota" moved to LOGÍSTICA section
✅ API /api/v2/vehicles CRUD completo
Status: Production Ready
Migration: e531d3d1fe20_fleet_refactor_vehicle_model
Commit: fcd0145 + posteriores
```

#### Inventory (Almacenes)
```
✅ Modelo Warehouse (tipos: MAIN, BRANCH, MOBILE)
✅ Stock tracking
✅ Movement logs
Status: Production Ready
```

#### Engineering (Ingeniería)
```
✅ Modelo Project, Task, Resource allocation
✅ Timeline view
Status: Production Ready
```

### Base de Datos (Q1)
```
✅ 50+ tablas diseñadas y migradas
✅ 100+ índices optimizados
✅ Foreign keys + constraints
✅ Soft-delete pattern implementado
✅ JSONB para eventos y metadata
✅ Alembic migrations ejecutadas
```

### Frontend (Q1)
```
✅ React 19 + Vite 7.3
✅ Tailwind CSS (Emerald dark mode)
✅ Shadcn UI components
✅ All modules integrated
✅ npm run build: 958 kB, 0 errors, 8.90s
```

### Backend (Q1)
```
✅ FastAPI + Uvicorn
✅ SQLAlchemy 2.0 (Mapped[], mapped_column())
✅ Pydantic validation
✅ RBAC middleware
✅ Error handling + logging
```

---

## 🚀 Q2 2026: Advanced Coordinación & Fleet (Abr-Jun)

### Phase 3A: Auditoría de Asignaciones (Priority: HIGH)

**Objective:** Rastrear quién cambió qué y cuándo en coordinación y fleet

**Features:**
```python
# Nueva tabla
class AssignmentAudit(Base):
    id, vehicle_id (FK), team_id (FK), 
    assigned_by_user_id (FK), assigned_at,
    unassigned_at, reason, metadata (JSONB)

# Queryable timeline:
# 2026-03-02 10:15 → Admin asigna Móvil AH0890S a Equipo Norte
# 2026-03-02 14:30 → Equipo Norte finaliza → unassign
# 2026-03-02 14:35 → Admin asigna a Equipo Sur
```

**UI:**
- History tab en FleetPage
- Audit trail por vehículo + filtros (fecha, usuario, tipo asignación)
- Report: Fleet utilization % tiempo asignado
- WorkOrder audit: quién asignó, cuándo, cambios de equipo

**Endpoints:**
```
GET /api/v2/vehicles/{id}/audit      # Timeline asignaciones vehículo
GET /api/v2/teams/{id}/audit         # Timeline equipo
GET /api/v2/work-orders/{id}/audit   # Timeline OT
```

**Implementación:** 1 sprint (7 días)  
**Owner:** Backend Dev

---

### Phase 3B: Mantenimiento Programado (Priority: HIGH)

**Objective:** Alertar cuando vehículo necesita service

**Features:**
```python
class VehicleMaintenanceSchedule(Base):
    id, vehicle_id (FK),
    maintenance_type (enum: OIL_CHANGE, TIRE_ROTATION, INSPECTION, REPAIR),
    last_performed_date, next_due_date,
    mileage_last, mileage_interval,
    alert_days_before, notes, cost_estimated

# Triggers:
- Si next_due_date < hoy → Alert: "Vehicle maintenance overdue"
- Si status = MAINTENANCE → No permite asignación a team
```

**Workflow:**
1. Mecánico marcar vehículo `status=MAINTENANCE`
2. Fleet admin cargar datos: tipo maintenance, próxima fecha
3. Sistema recalcular `next_due_date` (ej: +3 meses)
4. Cambiar status a `ACTIVE`
5. Team puede reasignar

**Endpoints:**
```
POST   /api/v2/vehicles/{id}/maintenance     # Registrar service
GET    /api/v2/vehicles/maintenance/due      # Listar vencidos
PUT    /api/v2/vehicles/{id}/maintenance/{id} # Update schedule
```

**UI:**
- MaintenanceDialog en FleetPage
- Badge "⚠️ Service Due" en tabla vehicles
- Dashboard: próximos 10 mantenimientos
- Calendar view por mes

**Implementación:** 1 sprint  
**Owner:** Backend + Frontend Dev

---

### Phase 3C: Tracking y Optimización de Rutas (Priority: MEDIUM)

**Objective:** GPS real-time, saber dónde están técnicos, optimizar viajes

**Features:**
```python
class VehicleLocation(Base):
    id, vehicle_id (FK), latitude, longitude,
    timestamp, speed, heading, accuracy

class RouteOptimization(Base):
    id, team_id (FK), date,
    optimized_waypoints (JSONB array),
    estimated_time_minutes, actual_time_minutes,
    efficiency_percent
```

**Workflow:**
1. Técnico acepta OT en app mobile (próxima fase)
2. App envía GPS cada 30s (batch cada 2 min)
3. Backend calcula ruta óptima (TSP solver o Vroom API)
4. Frontend sugiere orden de visitas
5. Técnico navega con app

**Endpoints:**
```
POST   /api/v2/vehicles/{id}/location        # GPS check-in (batch)
GET    /api/v2/teams/{id}/route-optimized    # Ruta sugerida
GET    /api/v2/vehicles/live                 # Mapa Live (all)
```

**UI:**
- Fleet map: iconos vehículos en tiempo real
- Team view: mostrar ruta propuesta en map
- WorkOrder detail: mostrar GPS track histórico

**Stack:**
- Frontend: Leaflet.js + OpenStreetMap OR Mapbox
- Backend: PostGIS para geo queries, optional Vroom API para ruta

**Implementación:** 2 sprints  
**Owner:** Backend (geo queries) + Frontend (map UI)

**Dependency:** Requiere GPS device/mobile app (se soluciona Q3)

---

### Phase 3D: Consumo de Combustible (Priority: MEDIUM)

**Objective:** Costear y auditar operación de flota

**Features:**
```python
class FuelEntry(Base):
    id, vehicle_id (FK), fuel_liters (decimal),
    cost_ars (decimal), odometer (int),
    timestamp, location, notes

# Aggregates:
- L/km promedio (últimos 30 días)
- Costo por km
- Detectar anomalías (consumo alto)
```

**Endpoints:**
```
POST   /api/v2/vehicles/{id}/fuel           # Registrar carga
GET    /api/v2/vehicles/{id}/fuel-stats     # Estadísticas
GET    /api/v2/fleet/fuel-report            # Report general
```

**UI:**
- FuelDialog en FleetPage
- Fleet dashboard: combustible YTD, promedio L/km
- Per-vehicle analytics
- Anomaly alerts

**Implementación:** 1 sprint  
**Owner:** Backend + Frontend

---

## 📋 Q3 2026: Mobile & IA & Reportes (Jul-Sep)

### Phase 4A: Mobile App para Técnicos (Q3)

**Stack:** React Native (Expo)

**Features:**
```
✅ Offline-first (SQLite local cache)
✅ Tickets + WorkOrders asignadas
✅ GPS tracking (background)
✅ Mobile warehouse: ver stock
✅ Firma digital de clientes
✅ Foto de trabajos (upload queue)
✅ Sync bidireccional con backend
✅ Push notifications
```

**Endpoints requeridos:**
```
GET  /api/v2/work-orders?assigned_to_team=X
POST /api/v2/work-orders/{id}/start
POST /api/v2/work-orders/{id}/complete
POST /api/v2/work-orders/{id}/signature
POST /api/v2/work-orders/{id}/photo
POST /api/v2/vehicles/{id}/location  (batched)
```

**Timeline:** 6-8 semanas, 1 React Native dev

---

### Phase 4B: IA para Coordinación (Q3-Q4)

**ML Models:**

1. **Auto-assign WorkOrders**
   - Histórico: OT → Team → Duración real
   - ML: predecir mejor equipo basado en zona, tipo OT, carga actual
   - Resultado: "Sugerir asignar Equipo Norte (92% confidence)"

2. **Execution Time Prediction**
   - Features: OT type, técnico skill, horario, zona
   - Predict: cuántos minutos tardará
   - Uso: scheduler propone ventanas reales

3. **Anomaly Detection**
   - Ticket que toma 4h cuando standard es 45 min
   - → Alert: "Possible escalation or complication"
   - → Revise notes, saber qué pasó

4. **Vehicle Recommendation**
   - Basado en: tipo OT, zona, carga actual
   - Solo sugerir vehículos ACTIVE
   - "Usar Móvil AH0890S para este viaje (10% menos combustible)"

**Implementación:**
- Train: 4 semanas (data collection)
- API: 2 semanas (inference endpoints)
- Timeline: Q3-Q4, 1 ML engineer + backend integration

---

### Phase 4C: Reportes Avanzados (Q3)

**Dashboards:**

1. **Fleet KPIs**
   - Utilización % (% horas asignado vs disponible)
   - Costo operativo (combustible + mantenimiento) por km
   - Downtime status (MAINTENANCE duración)
   - Age of vehicles + próximos retiros

2. **Coordinación SLA**
   - % OT assigned < 24h de creación
   - % OT scheduled < 48h
   - % OT completed on-time
   - Equipo performance ranking

3. **Técnico Performance**
   - OT completadas/mes
   - Resolución tiempo promedio
   - Customer satisfaction (estrellas)
   - Skill matrix (tipos OT especialización)

4. **Customer Satisfaction**
   - NPS por técnico
   - Resolución rate (1st call fix %)
   - Repeat issue rate

**UI:**
- React + Recharts/Victory para gráficos
- Export PDF, CSV
- Scheduled email reports

**Implementación:** 2 sprints  
**Owner:** Frontend + Backend (analytics queries)

---

## 📊 Q4 2026: Integraciones & Hardening

### Phase 5A: Accounting Integration

**Features:**
```
- Gastos combustible → Accounting module
- Depreciation vehículos
- Mantenimiento costs
- Invoice reconciliation
```

**Endpoints:** Link a backend accounting (TBD)

---

### Phase 5B: Professional GPS Integration

**Options:**
- Trackier API (comercial)
- CarNext (comercial)
- Self-hosted PostGIS (open-source)

**Timeline:** Q4, 1 backend dev

---

### Phase 5C: Auto-Invoicing

**Features:**
```
- OT completed → Generate invoice
- Incluir: zona, tiempo, técnico, parts
- Send to customer automático
- Integrate ISPCube for reconciliation
```

---

### Phase 5D: Slack/Telegram Alerts

**Features:**
```
- Coordinator alerts: "OT vencida sin asignación"
- Tech alerts: "GPS parado > 30 min"
- Admin alerts: "Vehicle maintenance overdue"
```

---

## 📊 Métricas & Health Check (Actual - 2 Mar 2026)

### Sistema
```
Uptime:           99.5% (producción)
DB Size:          ~500 MB
API Response:     <200ms (p95)
Frontend Build:   8.90s
Frontend Bundle:  958 kB (gzip: 263 kB)
Modules compiled: 2697
```

### Carga Operativa
```
Tickets/OT:       ~50 generados/mes
Teams activos:    10
Vehicles:         3 operacionales (ACTIVE)
Daily Sync:       ✅ OK (22:00 UTC)
BD Queries/s:     <100 (durante pico)
```

### Code Quality
```
Errors en build:  0
Warnings:         <10 (linting)
Test coverage:    ~60% (backend)
Documentation:    ✅ Completa (4 critical docs)
```

---

## 🎯 Decisiones Arquitectónicas Clave

### ✅ Decidido: Vehicle como Activo Físico Separado
- **Alternativa rechazada:** Warehouse como vehículo
- **Razón:** Claridad semántica, permite futura extensión (mantenimiento, combustible, GPS)
- **Beneficio:** Tablas normalizadas, queries optimizadas

### ✅ Decidido: 1:1 Vehicle ↔ Warehouse MOBILE (auto-creada)
- **Alternativa rechazada:** Warehouses sin vehicles
- **Razón:** Simplifica queries, garantiza integridad referencial
- **Beneficio:** Auto-creation de Warehouse al crear Vehicle

### ✅ Decidido: team.vehicle_id Opcional (0..1)
- **Alternativa rechazada:** Obligatorio
- **Razón:** Flexibilidad para equipos sin asignación o multi-equipos
- **Beneficio:** Soporta workflows variados

### ✅ Decidido: SQLAlchemy 2.0 + Mapped[] + typed ORM
- **Alternativa:** SQLAlchemy 1.4 syntax
- **Razón:** Type-safe, mejor soporte SQL, migration-ready
- **Beneficio:** Errores detectados en startup, no en runtime

### ✅ Decidido: JSONB para Eventos & Metadata
- **Alternativa:** Tablas normalizadas
- **Razón:** Flexibilidad, no requiere migración para nuevos campos
- **Beneficio:** Auditoría + eventos inmutable

### 🚧 Por decidir: GPS Vendor (Q3)
- **Opciones:** Self-hosted (PostGIS), Trackier, CarNext
- **Criterio:** Costo, integridad datos, real-time capability
- **Timeline:** Q2 fin

---

## 👥 Team Responsabilidades

| Rol | Responsable | Status | Next |
|-----|-------------|--------|------|
| **Backend Lead** | [Name] | Q1 Done | Q2 Auditoría + Mantenimiento |
| **Frontend Lead** | [Name] | Q1 Done | Q2 UI dialogs |
| **Database Architect** | [Name] | Q1 Done | Q2 Performance tuning |
| **QA/Testing** | [Name] | Q1 Testing | Q2 Regression suite |
| **DevOps** | [Name] | Infra OK | Q2+ Monitoring |
| **React Native** | [TBD] | - | Q3 Mobile app |
| **ML Engineer** | [TBD] | - | Q3 IA models |

---

## 📝 Próximas Decisiones

### Pre-Q2:
- [ ] Prioridad: Auditoría vs Mantenimiento (ambos HIGH)
- [ ] Estimaciones exactas por feature
- [ ] Asignación de sprints

### Q2 Fin:
- [ ] GPS vendor selection
- [ ] Mobile app tech stack

### Q3:
- [ ] ML framework (TensorFlow, PyTorch)
- [ ] Mobile app rollout strategy

---

## 📞 Mantenimiento de Roadmap

**Responsable:** Product Manager / Tech Lead  
**Frecuencia:** Actualización cada 2 semanas (Q2), mensual luego  
**Criterio:** Features completadas, blockers, prioridad changes

**Checklist de actualización:**
- [ ] Status de features (NOT STARTED → IN PROGRESS → DONE)
- [ ] Blockers y dependencias
- [ ] Estimaciones reajustadas si es necesario
- [ ] Próximas 2 semanas claramente definidas

---

## 🔗 Referencias Cruzadas

- [MASTER_CONTEXT.md](MASTER_CONTEXT.md) - Arquitectura general
- [AI_ARCHITECT_CONTEXT.md](AI_ARCHITECT_CONTEXT.md) - Decisiones + troubleshooting
- [BASE_DATOS.md](BASE_DATOS.md) - Esquema BD detallado
- [FLEET_MODULE.md](FLEET_MODULE.md) - Fleet implementation details
- [CURRENT_STATUS_2026-03-02.md](CURRENT_STATUS_2026-03-02.md) - Snapshot sesión
- [_CRITICAL_DOCS_FOR_AI.md](_CRITICAL_DOCS_FOR_AI.md) - Este archivo + manifest

---

## 📊 Estimaciones Resumen

| Phase | Features | Sprints | Team |
|-------|----------|---------|------|
| Q1 | Auth, Tickets, OT, Coord, Fleet | 8 | 2 backend, 2 frontend |
| Q2 Phase 3A | Auditoría | 1 | 1 backend |
| Q2 Phase 3B | Mantenimiento | 1 | 1 backend, 1 frontend |
| Q2 Phase 3C | Tracking GPS | 2 | 1 backend, 1 frontend |
| Q2 Phase 3D | Combustible | 1 | 1 backend, 1 frontend |
| Q3 Phase 4A | Mobile app | 6-8 | 1 React Native |
| Q3 Phase 4B | IA models | 6 | 1 ML + 1 backend |
| Q3 Phase 4C | Reportes | 2 | 1 frontend, 1 backend |
| Q4 Phase 5 | Integraciones | 4 | 2 backend |

**Total Q2-Q4:** ~26 sprints, ~13 weeks continuous, 2-3 person team

---

**Mantenedor:** LukeSkywalker66  
**Status:** 🟢 ON TRACK  
**Última revisión:** 2 de marzo 2026  
**Próxima revisión:** 16 de marzo 2026 (inicio Q2)

