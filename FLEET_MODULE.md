# 🚛 Módulo de Flota (Fleet) - Arquitectura y Documentación

**Fecha**: 2 de marzo de 2026  
**Estado**: ✅ Completo y funcional

---

## 📋 Resumen Ejecutivo

El módulo Fleet implementa la gestión de vehículos operativos en Emerald ERP con separación clara entre **activos físicos** (Vehicle) e **inventario** (Warehouse).

### Principios de Diseño
- **Vehicle** = Activo físico (patente, marca, modelo, año)
- **Warehouse (tipo MOBILE)** = Contenedor de inventario del vehículo (auto-creado)
- **1:1 relación** Vehicle ↔ Warehouse con integridad referencial
- **Interfaz administrativa** aislada de vistas operativas

---

## 🏗️ Arquitectura

### Backend (`backend/src/`)

#### Modelos (`models/fleet.py`)
```python
class Vehicle(Base):
    id, name, license_plate, vehicle_brand, vehicle_model, vehicle_year, 
    status (ACTIVE|MAINTENANCE|RETIRED|DONATED),
    warehouse_id (FK → warehouses.id),
    created_at, updated_at
```

**Relaciones**:
- `vehicle.warehouse` → Warehouse (tipo MOBILE)
- `vehicle.team` → Team (opcional, 0..1)

#### API Router (`routers/fleet.py`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v2/vehicles` | Crear vehículo + warehouse automático |
| GET | `/api/v2/vehicles` | Listar vehículos (filtrable por `?status=ACTIVE`) |
| GET | `/api/v2/vehicles/{id}` | Detalle vehículo con team asignado |
| PUT | `/api/v2/vehicles/{id}` | Actualizar vehículo |
| DELETE | `/api/v2/vehicles/{id}` | Soft-delete vehículo |

**Features**:
- Auto-creación de Warehouse MOBILE con nombre `"Stock - {vehicle.name}"`
- Validación de patente única (si se provee)
- Información de team asignado en respuestas GET
- Filtrado por status con enum validation

#### Schemas (`schemas/fleet.py`)
- `VehicleCreate` → input para POST
- `VehicleUpdate` → input para PUT
- `VehicleResponse` → respuesta simple
- `VehicleDetailResponse` → respuesta con team info

#### Migración (`alembic/versions/e531d3d1fe20_*.py`)
- Crea tabla `vehicles` con constraints y foreign keys
- Migra `warehouses.user_id` (legacy) → nuevas relaciones Vehicle+Team
- 3 MOBILE warehouses existentes fueron migrados a vehículos

---

### Frontend (`frontend/src/`)

#### Página Administrativa (`pages/fleet/FleetPage.jsx`)
- **Tabla** con columnas: Vehículo | Patente | Modelo | Warehouse | Estado | Acciones
- **CRUD buttons**: Create, Edit, Delete
- **Status badges**: emerald (ACTIVE), amber (MAINTENANCE), ruby (RETIRED), cyan (DONATED)
- **Loading/Empty states** con iconografía

#### Componentes de Diálogos

**CreateVehicleDialog** (`components/fleet/CreateVehicleDialog.jsx`)
- Form: name (required), license_plate, vehicle_brand, vehicle_model, vehicle_year, status
- `onPointerDownOutside` prevention (no cierre accidental)
- Tema: verde (emerald)

**EditVehicleDialog** (`components/fleet/EditVehicleDialog.jsx`)
- Pre-popula datos con useEffect
- Formula igual a Create, tema ámbar

#### Servicio API (`services/fleet.service.js`)
```javascript
fleetService.getVehicles({ status?: 'ACTIVE' })
fleetService.getVehicleDetail(vehicleId)
fleetService.createVehicle(payload)
fleetService.updateVehicle(vehicleId, payload)
fleetService.deleteVehicle(vehicleId)
```

#### Integración en Otras Vistas

**AppSidebar** (`components/AppSidebar.jsx`)
- Item "Flota" dentro de sección "LOGÍSTICA" (debajo de Almacenes)
- Icono Truck
- Ruta: `/app/fleet`

**TeamCard enhancement** (`components/coordination/TeamCard.jsx`)
- Muestra vehículo asignado con Truck icon + modelo/patente
- Warehouse asociado con Package icon
- Fallback "Sin vehículo asignado" si team.vehicle_id = null

**CuadrillasPage** (`pages/coordination/CuadrillasPage.jsx`)
- Carga vehículos ACTIVE con `fleetService.getVehicles()`
- Selector de vehículos en CreateTeamDialog/EditTeamDialog
- Filtra vehículos ya asignados (no permite duplicados)

---

## 🚀 Flujos de Uso

### Crear Vehículo
1. Navega a **Logística → Flota** (sidebar)
2. Botón **"Nuevo Vehículo"**
3. Completa form (nombre requerido)
4. Al guardar:
   - ✅ Se crea Vehicle en DB
   - ✅ Se auto-crea Warehouse MOBILE
   - ✅ Se establece FK vehicle.warehouse_id
5. Aparece en tabla Fleet

### Asignar Vehículo a Cuadrilla
1. Navega a **Operaciones → Cuadrillas**
2. Botón **"Nueva Cuadrilla"** o **Editar**
3. Dropdown "Vehículo disponible" carga vehículos ACTIVE
4. Selecciona vehículo
5. Se establece `team.vehicle_id`
6. En TeamCard aparece modelo/patente + warehouse

### Historial de Cambios
- Vehículos: `created_at`, `updated_at`
- Logs operativos en backend (stdout docker)
- Auditoría de asignaciones en `Team.vehicle_id` (cambios históricos)

---

## 🔍 Validaciones y Constraints

| Campo | Regla |
|-------|-------|
| `name` | 3-150 caracteres, requerido |
| `license_plate` | 0-20 caracteres, única, opcional |
| `vehicle_year` | 1900-2200, opcional |
| `status` | ENUM (ACTIVE\|MAINTENANCE\|RETIRED\|DONATED) |
| `warehouse_id` | FK requerida, integridad referencial |

---

## 🛠️ Testing Manual

```bash
# Backend health check
curl http://localhost:8500/api/v2/vehicles

# Crear vehículo
curl -X POST http://localhost:8500/api/v2/vehicles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Móvil Test",
    "license_plate": "TEST123",
    "vehicle_brand": "Toyota",
    "vehicle_model": "Hilux",
    "vehicle_year": 2024,
    "status": "ACTIVE"
  }'

# Listar activos solo
curl 'http://localhost:8500/api/v2/vehicles?status=ACTIVE'
```

---

## 📝 Próximos Pasos (Roadmap)

- [ ] Historial de asignaciones (auditoría de vehicle_id changes)
- [ ] Mantenimiento programado (alertas de service)
- [ ] Tracking de combustible y viajes
- [ ] Integración con GPS/tracking de campo
- [ ] Reportes de utilización de flota

---

## 📚 Referencias

- **Legacy Warehouse model**: `backend/src/models/inventory.py` (WarehouseType.MOBILE)
- **Team model**: `backend/src/models/coordination.py` (team.vehicle_id FK)
- **Coordinate page**: `frontend/src/pages/coordination/CuadrillasPage.jsx`
- **Lore**: "La Máquina" - Orquestador de activos operativos 🚛✨
