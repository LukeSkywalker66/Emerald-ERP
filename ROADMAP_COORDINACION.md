# 🗺️ Roadmap Coordinación y Fleet - 2026

**Versión:** 2026-03-02  
**Última revisión:** 2 de marzo de 2026  
**Status:** 2 de 3 fases completadas

---

## 📋 Índice

1. Fase 1: Coordinación Base (Completada ✅ 02/02)
2. Fase 2: Fleet Operativo (Completada ✅ 03/02)
3. Fase 3: Avanzadas (Próxima → Q2 2026)
4. Roadmap a Largo Plazo (Q3-Q4 2026)

---

## ✅ Fase 1: Coordinación Base (Completada - 02/02/2026)

### Objetivos Alcanzados
- ✅ Modelo Team (cuadrillas) con members
- ✅ Estados de WorkOrder: pending_planning → coordinated → scheduled → completed
- ✅ Scheduler: scheduled_start, estimated_duration
- ✅ Asignación de OT a equipos
- ✅ Grid coordinación interactivo (mapa + timeline)
- ✅ TeamCard mejorada (visible en cuadrillas)

### Cambios en BD (Migración 2026_02_02_002)
```sql
ALTER TABLE work_orders
  ADD COLUMN team_id INT REFERENCES teams(id) SET NULL,
  ADD COLUMN scheduled_start TIMESTAMP,
  ADD COLUMN estimated_duration INT,
  ADD COLUMN coordination_notes TEXT;

CREATE INDEX ix_work_orders_team_scheduled 
  ON work_orders(team_id, scheduled_start);
```

### Nuevos Estados WorkOrder
```python
# Antes: pending, in_progress, completed
# Ahora:
pending_planning   # Aún no pacta fecha
  ↓
coordinated        # Fecha pactada, sin equipo asignado
  ↓
scheduled          # Fecha + equipo asignado
  ↓
in_progress        # Técnico ejecutando
  ↓
completed          # Finalizado
```

### UI Implementada (02/02)
- ✅ CoordinationGridPage: Grid con equipos + OT horario
- ✅ CuadrillasPage: CRUD de teams, members
- ✅ TeamCard: info básica (nombre, líder, qty técnicos)

**Commit:** 27d6fe3 (antes de Fleet refactor)

---

## ✅ Fase 2: Fleet Operativo (Completada - 03/02/2026)

### Objetivos Alcanzados
- ✅ Modelo Vehicle (activos físicos)
- ✅ Enum VehicleStatus: ACTIVE, MAINTENANCE, RETIRED, DONATED
- ✅ 1:1 Vehicle ↔ Warehouse MOBILE (auto-creada)
- ✅ API `/api/v2/vehicles` CRUD
- ✅ FleetPage: tabla administrativa
- ✅ Asignación de vehículos a teams
- ✅ TeamCard mejorada: muestra vehículo (modelo + patente)
- ✅ CuadrillasPage: selector vehículos en diálogos

### Cambios en BD (Migración e531d3d1fe20)
```sql
CREATE TABLE vehicles (
    id INT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    license_plate VARCHAR(20) UNIQUE,
    vehicle_brand VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_year INT CHECK (vehicle_year >= 1900 AND vehicle_year <= 2200),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE teams
  ADD COLUMN vehicle_id INT REFERENCES vehicles(id) SET NULL;

ALTER TABLE warehouses
  ADD RELATIONSHIP vehicle (1:1 optional);
```

**Datos Iniciales:**
- 3 MOBILE warehouses migrados → vehículos (Móvil AH0890S, movil ac31231, Camioneta Técnico 2)

### UI Implementada (03/02)
- ✅ FleetPage: tabla Vehículo | Patente | Modelo | Warehouse | Estado | Acciones
- ✅ CreateVehicleDialog: form name, plate, brand, model, year, status
- ✅ EditVehicleDialog: pre-popula datos
- ✅ AppSidebar: "Flota" movido a sección "LOGÍSTICA"
- ✅ TeamCard: display vehículo (Truck icon + modelo/patente + Package + warehouse)

### API
```
POST   /api/v2/vehicles              # Crea Vehicle + Warehouse MOBILE
GET    /api/v2/vehicles?status=ACTIVE # Listar (filtrable)
GET    /api/v2/vehicles/{id}         # Detalle con team asignado
PUT    /api/v2/vehicles/{id}         # Actualizar
DELETE /api/v2/vehicles/{id}         # Soft-delete
```

**Commit:** fcd0145 (feat: módulo Fleet completo)

---

## ⭐ AHORA - Status Actual (03/02/2026)

### Estado de Módulos
| Módulo | Status | Completitud | Próximos Pasos |
|--------|--------|-------------|----------------|
| **Coordinación** | ✅ Ready | 100% | Auditoría de cambios |
| **Fleet** | ✅ Ready | 100% | Mantenimiento programado |
| **Tickets** | ✅ Ready | 100% | Escalación automática |
| **Inventario** | ✅ Ready | 100% | Alertas de stock bajo |
| **Ingeniería** | ✅ Ready | 100% | Timeline compartida |

### Base de Datos
- ✅ 50+ tablas
- ✅ 100+ índices optimizados
- ✅ Foreign keys + constraints
- ✅ Soft-delete pattern implementado

### Frontend
- ✅ npm run build: 958 kB, 0 errores
- ✅ Todos los módulos integrados
- ✅ UI coherente (Emerald dark mode)
- ✅ Responsive (mobile-ready)

---

## 🚀 Fase 3: Avanzadas Coordinación (Próxima - Q2 2026)

### 3.1 Auditoría de Asignaciones (Priority: HIGH)

**Objetivo:** Rastrear quién cambió qué y cuándo en coordinación

**Features:**
```python
# Nueva tabla
class AssignmentAudit(Base):
    id, truck_id (FK), team_id (FK), 
    assigned_by_user_id (FK), assigned_at,
    unassigned_at, reason, metadata (JSONB)

# Timeline:
2026-03-02 10:15 → Admin asigna Móvil AH0890S a Equipo Norte
2026-03-02 14:30 → Equipo Norte finaliza → unassign
2026-03-02 14:35 → Admin asigna a Equipo Sur
```

**UI:**
- History tab en FleetPage
- Fleet utilization report (% de tiempo asignado)
- Audit trail por vehículo

**Implementación:** 1 sprint (1 semana)

---

### 3.2 Mantenimiento Programado (Priority: HIGH)

**Objetivo:** Alertar cuando vehículo necesita service

**Features:**
```python
class VehicleMaintenanceSchedule(Base):
    id, vehicle_id (FK),
    maintenance_type (enum: OIL_CHANGE, TIRE_ROTATION, INSPECTION),
    last_performed_date, next_due_date,
    mileage_last, mileage_interval, alert_days_before

# Triggers:
- Si scheduled_date < hoy → Alert: "Vehicle maintenance overdue"
- Si status = MAINTENANCE → No permite asignación a team
```

**Workflow:**
1. Mecánico marca vehículo status=MAINTENANCE
2. Fleet admin carga fecha maintenance
3. Sistema recalcula next_due_date
4. Status = ACTIVE
5. Team puede reasignar

**Endpoints:**
```
POST   /api/v2/vehicles/{id}/maintenance   # Registrar service
GET    /api/v2/vehicles/maintenance/due    # Reportar vencidos
```

**UI:**
- Maintenance tab en FleetPage
- Badge "⚠️ Service Due" en tabla
- Calendar view de mantenimientos

**Implementación:** 1 sprint

---

### 3.3 Tracking y Optimización de Rutas (Priority: MEDIUM)

**Objetivo:** Saber dónde están los técnicos, optimizar viajes

**Features:**
```python
class VehicleGPS(Base):
    id, vehicle_id (FK), latitude, longitude,
    timestamp, speed, accuracy

class RouteOptimization(Base):
    id, team_id (FK), date, optimized_route (JSONB array de coords),
    estimated_time, actual_time, efficiency_pct
```

**Workflow:**
1. Técnico acepta OT en app mobile
2. App envia GPS cada 30s
3. Sistema calcula ruta óptima (TSP solver)
4. Backend sugiere orden de visitas
5. App muestra siguientes 3 paradas

**Endpoints:**
```
POST   /api/v2/vehicles/{id}/location     # GPS check-in
GET    /api/v2/teams/{id}/route-optimized # Ruta sugerida
```

**Integración:** Leaflet.js en frontend, Vroom API opcional

**Implementación:** 2 sprints

---

### 3.4 Consumo de Combustible (Priority: MEDIUM)

**Objetivo:** Costear y auditar operación de flota

**Features:**
```python
class FuelEntry(Base):
    id, vehicle_id (FK), fuel_liters, cost_ars,
    odometer, timestamp, location

# Métricas:
- L/km promedio
- Costo por km
- Anomalías (consumo alto)
```

**UI:**
- Fleet dashboard: combustible YTD
- Per-vehicle analytics
- Anomaly alerts

**Implementación:** 1 sprint

---

## 🌟 Fase 4: Roadmap Largo Plazo (Q3-Q4 2026)

### 4.1 Mobile App para Técnicos (Q3)
```
Stack: React Native
Features:
- Offline-first (SQLITE local)
- Tickets + OT asignadas
- GPS tracking
- Stock warehouse mobile
- Firma digital de clientes
- Foto de trabajo
- Sincronización bidireccional
```

### 4.2 IA para Coordinación (Q3-Q4)
```
Features:
- Auto-asignar OT a equipos (ML: historical performance)
- Predicción de tiempo de ejecución
- Detectar anomalías (ticket que toma +2h usual)
- Recomendación de vehículo basado en zona/tipo OT
```

### 4.3 Reportes Avanzados (Q3)
```
Dashboards:
- Fleet KPIs (utilización, costo, mantenimiento)
- Coordinación: SLA cumplimiento
- Técnico: performance ranking
- Customer: resolución rates por técnico
```

### 4.4 Integraciones (Q4)
```
- Conectar con Accounting (gastos combustible)
- Integración con GPS profesional (Trackier, CarNext)
- Facturación automática (comprobantes OT)
- Slack/Telegram alerts para coordinador
```

---

## 📊 Metrics & Health Check (Actual)

### Sistema
```
Uptime: 99.5% (producción)
DB Size: ~500 MB
API Response: <200ms (p95)
Frontend Build: 8.90s
Frontend Bundle: 958 kB (gzip 263 kB)
```

### Módulos
```
Tickets/OT: ~50 generados/mes
Teams: 10 activos
Vehicles: 3 operacionales
Daily Sync: ✅ OK (22:00 UTC)
```

---

## 🎯 Prioridades Q1-Q2 2026

### Q1 (Ene-Mar)
- ✅ Coordinación base → DONE (02/02)
- ✅ Fleet MVP → DONE (03/02)
- 🚧 Auditoría asignaciones → Pending
- 🚧 Mantenimiento programado → Pending

### Q2 (Abr-Jun)
- [ ] Mobile app alpha
- [ ] Tracking GPS
- [ ] Reportes avanzados
- [ ] IA para coordinación (POC)

**Estimado:** 8 semanas, 2 frontend devs + 1 backend dev

---

## 📝 Decisiones Tomadas

### ✅ Decidido: Vehicle como activo físico
- **Alternativa rechazada:** Warehouse como vehículo
- **Razón:** Claridad semántica + futura extensión (mantenimiento, combustible)

### ✅ Decidido: 1:1 Vehicle ↔ Warehouse MOBILE
- **Alternativa rechazada:** Warehouses sin vehicles
- **Razón:** Simplifica queries, garantiza integridad

### ✅ Decidido: team.vehicle_id opcional (0..1)
- **Alternativa rechazada:** Obligatorio
- **Razón:** Flexibilidad para equipos sin asignación

### 🚧 Próximo decidir: GPS vendor
- **Opciones:** Self-hosted (backend), Trackier, CarNext
- **Timeline:** Q2 2026

---

## 🔗 Referencias Cruzadas

- **Implementación Fleet:** [FLEET_MODULE.md](FLEET_MODULE.md)
- **Details BD:** [BASE_DATOS.md](BASE_DATOS.md)
- **Status sesión:** [CURRENT_STATUS_2026-03-02.md](CURRENT_STATUS_2026-03-02.md)
- **Arquitectura General:** [MASTER_CONTEXT.md](MASTER_CONTEXT.md)

---

## 👥 Team Responsabilidades

| Role | Responsable | Sprint |
|------|-------------|--------|
| **Coordinación Backend** | Backend Dev | Done (02/02) |
| **Fleet Backend** | Backend Dev | Done (03/02) |
| **Fleet Frontend** | Frontend Dev | Done (03/02) |
| **Auditoría** | Backend Dev | Q2 |
| **Mantenimiento** | Backend + Frontend | Q2 |
| **Mobile App** | React Native Dev | Q3 |

---

## 📞 Contacto y Feedback

**Mantenedor:** LukeSkywalker66  
**Última revisión:** 2 de marzo de 2026  
**Próxima revisión:** 6 de abril de 2026

---

**Status:** 🟢 ON TRACK - Fase 3 por comenzar Q2
