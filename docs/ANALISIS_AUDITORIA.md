# 🔍 Análisis Completo del Sistema de Auditoría — Emerald ERP

**Fecha:** 2026-05-20  
**Versión:** 1.0  
**Objetivo:** Evaluar cobertura, eficiencia y proponer mejoras al motor de auditoría universal ("Ojo de Dios").

---

## Índice

1. [Arquitectura Actual](#1-arquitectura-actual)
2. [Cobertura por Módulo](#2-cobertura-por-módulo)
3. [Respuestas a Preguntas Específicas](#3-respuestas-a-preguntas-específicas)
4. [Análisis de Eficiencia — Tráfico](#4-análisis-de-eficiencia--tráfico)
5. [Análisis de Eficiencia — Almacenamiento](#5-análisis-de-eficiencia--almacenamiento)
6. [Problemas de Performance Identificados](#6-problemas-de-performance-identificados)
7. [Plan de Implementación para Cobertura Faltante](#7-plan-de-implementación-para-cobertura-faltante)
8. [Resumen Ejecutivo](#8-resumen-ejecutivo)

---

## 1. Arquitectura Actual

### 1.1 Modelo de Datos (`backend/src/models/audit.py`)

```
┌──────────────────────────────────────────────────┐
│                   AuditLog                        │
├──────────────────────────────────────────────────┤
│ id            │ Integer (PK)                      │
│ user_id       │ FK → users.id (nullable)          │ ← Quién
│ action        │ String (AuditAction enum)          │ ← Qué acción
│ entity_name   │ String(100)                        │ ← Qué módulo/entidad
│ entity_id     │ Integer (nullable)                 │ ← ID del registro
│ old_values    │ JSONB (nullable)                   │ ← Cómo era ANTES
│ new_values    │ JSONB (nullable)                   │ ← Cómo quedó DESPUÉS
│ ip_address    │ String(45) (nullable)              │ ← Desde dónde
│ user_agent    │ String(255) (nullable)             │ ← Desde qué cliente
│ status        │ String (success/failure)           │ ← Resultado
│ error_message │ Text (nullable)                    │ ← Si falló
│ created_at    │ DateTime (via TimestampMixin)       │ ← Cuándo
└──────────────────────────────────────────────────┘
```

### 1.2 Valores del Enum `AuditAction`

| Valor | Significado |
|-------|-------------|
| `CREATE` | Creación de un registro |
| `UPDATE` | Modificación de un registro |
| `DELETE` | Eliminación de un registro |
| `LOGIN` | Inicio de sesión |
| `LOGOUT` | Cierre de sesión |
| `ACCESS_DENIED` | Intento de acceso no autorizado |
| `EXPORT` | Exportación de datos |
| `IMPORT` | Importación de datos |

### 1.3 Helpers de Auditoría (`backend/src/utils/audit.py`]

La capa de utilerías provee 5 funciones:

| Función | Propósito |
|---------|-----------|
| `log_audit_action()` | Función base — registra cualquier acción con todos los parámetros |
| `log_create()` | Atajo para `AuditAction.CREATE` |
| `log_update()` | Atajo para `AuditAction.UPDATE` — requiere `old_values` + `new_values` |
| `log_delete()` | Atajo para `AuditAction.DELETE` |
| `log_access_denied()` | Atajo para `AuditAction.ACCESS_DENIED` con status failure |
| `get_entity_dict()` | Serializa un modelo SQLAlchemy a dict JSON-serializable |

**Patrón de uso consistente:**
```python
try:
    # ... operación principal ...
    log_create(db, user_id, "entity_name", entity_id, new_values={...})
except Exception as e:
    db.rollback()
    raise
```

Todas las llamadas de auditoría son **non-blocking**: si el log de auditoría falla, la operación principal continúa. Usan `try/except` que captura y loguea el error sin interrumpir el flujo.

### 1.4 Endpoint de Consulta (`backend/src/routers/audit.py`)

| Endpoint | Método | Descripción | Auth |
|----------|--------|-------------|------|
| `/api/v2/audit-logs` | GET | Lista paginada con filtros | Admin only (`require_admin`) |
| `/api/v2/audit-logs/{id}` | GET | Detalle por ID | Admin only |

**Filtros disponibles:**
- `user_id` — filtrar por usuario que ejecutó la acción
- `action` — filtrar por tipo (CREATE, UPDATE, DELETE, etc.)
- `entity_name` — filtrar por entidad (warehouses, tickets, teams, etc.)
- `entity_id` — filtrar por ID de registro específico
- `status_filter` — filtrar por estado (success/failure)

**Paginación:** `limit` (1-500, default 100) + `offset` (default 0)

### 1.5 Frontend (`frontend/src/pages/audit/AuditLogsPage.jsx`)

- Ruta: `/app/audit`
- Protegida por RBAC: solo usuarios con rol `admin` y permiso `audit_logs:view`
- Tabla con columnas: Fecha/Hora, Usuario, Acción (badge coloreado), Entidad, ID, Estado, Acciones
- Modal de detalle con `old_values` y `new_values` renderizados como JSON formateado
- Filtros: entidad (texto), acción (select), user_id (número)
- Paginación: 50 registros por página

---

## 2. Cobertura por Módulo

### 2.1 Módulos CON Auditoría

| Módulo | Archivo | Llamadas | CREATE | UPDATE | DELETE | Observaciones |
|--------|---------|----------|--------|--------|--------|---------------|
| **Inventario** | `inventory.py` | 6 | ✅ warehouse, product, stock transfer | ✅ warehouse, product | ✅ warehouse, product | Completo. Stock transfer también logueado |
| **Usuarios v2** | `v2/users.py` | 4 | ✅ user | ✅ user, status | ✅ user | Completo |
| **Work Orders** | `work_orders.py` | 3 | ✅ work_order | ✅ work_order, assign | ❌ | Asignación a equipo logueada como UPDATE |
| **Tickets** | `tickets.py` | 2 | ✅ ticket | ✅ ticket | ❌ | No hay DELETE de tickets (soft delete?) |
| **Flota (inspecciones)** | `fleet.py` | 1 | ✅ inspection | ❌ | ❌ | Solo creacion de inspección |

### 2.2 Módulos SIN Auditoría

| Módulo | Archivo | CREATE | UPDATE | DELETE | Miembros | Rol | Impacto |
|--------|---------|--------|--------|--------|----------|-----|---------|
| **Coordinación (Teams)** | `coordination.py` + `team_service.py` | ❌ | ❌ | ❌ | ❌ (add/remove) | ❌ (change role) | **CRÍTICO** — cero auditoría |
| **Flota (Vehículos)** | `fleet.py` | ❌ | ❌ | ❌ | — | — | **ALTO** — solo inspecciones tienen log |
| **Ingeniería** | `engineering.py` | ❌ | ❌ | ❌ | — | — | **MEDIO** — tareas sin tracking |
| **Tags** | `tags.py` (si existe) | ❌ | ❌ | ❌ | — | — | **BAJO** — tags son datos de referencia |
| **Installation Types** | `installation_types.py` | ❌ | ❌ | ❌ | — | — | **BAJO** — read-only endpoint |
| **Search** | `search.py` | ❌ | ❌ | ❌ | — | — | **BAJO** — solo búsqueda |

### 2.3 Mapa Visual de Cobertura

```
                    ┌─────────────────────────┐
                    │   Audit Coverage Map     │
                    └─────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   🟢 99%                   🔴 0%                    🟡 50%
 Inventario              Coordinación               Flota Vehículos
 (warehouse+product)     (teams+members)            (solo inspections)
        │                        │                        │
        │                   ● create_team             ● create_vehicle
        │                   ● update_team             ● update_vehicle
        │                   ● delete_team             ● delete_vehicle
        │                   ● add_member              
        │                   ● remove_member           
        │                   ● update_role             
```

---

## 3. Respuestas a Preguntas Específicas

### ❓ "Si cambio de cuadrilla a un técnico, ¿queda registro?"

**NO.** El módulo de Coordinación no tiene **ninguna** llamada a auditoría. 

Las acciones que **NO** quedan registradas:
1. Crear una cuadrilla (`POST /teams`)
2. Modificar una cuadrilla (nombre, vehículo asignado, activo) (`PUT /teams/{id}`)
3. Eliminar (desactivar) una cuadrilla (`DELETE /teams/{id}`)
4. Agregar un técnico a una cuadrilla (`POST /teams/{id}/members`)
5. Quitar un técnico de una cuadrilla (`DELETE /teams/{id}/members/{user_id}`)
6. Cambiar el rol de un técnico dentro de la cuadrilla (`PUT /teams/{id}/members/{user_id}/role`)

Toda la lógica vive en [`backend/src/services/team_service.py`](backend/src/services/team_service.py) y el router [`backend/src/routers/coordination.py`](backend/src/routers/coordination.py). Ninguno importa ni llama a las funciones de auditoría.

### ❓ "Si cambio de móvil (vehículo), ¿queda registro?"

**NO.** Las operaciones CRUD de vehículos en [`backend/src/routers/fleet.py`](backend/src/routers/fleet.py) **no tienen auditoría**. 

- `create_vehicle()` — línea 63: sin auditoría
- `update_vehicle()` — línea 213: sin auditoría (cambia datos del vehículo, asigna a equipo)
- `delete_vehicle()` — línea 280: sin auditoría

Solo las **inspecciones diarias** (`create_vehicle_inspection()`, línea 397) tienen `log_create`.

### ❓ "Queda registro del tipo 'tal día a tal hora, tal persona ejecutó esta acción en el módulo tanto'?"

**Sí, donde está implementado**. El modelo `AuditLog` registra exactamente eso:
- `created_at` → "tal día a tal hora"
- `user_id` → "tal persona" (resuelto a `user_name` en la respuesta)
- `action` + `entity_name` → "ejecutó esta acción en el módulo tanto"
- `entity_id` → sobre qué registro específico

Además, cuando es un `UPDATE`, guarda los valores anteriores y nuevos en JSONB, permitiendo ver exactamente **qué cambió** (ej: "cambió el nombre del almacén de 'A' a 'B'").

---

## 4. Análisis de Eficiencia — Tráfico

### 4.1 Escritura (Logging)

Cada acción auditada genera **1 INSERT** en la tabla `audit_logs`. El payload típico:

| Campo | Tamaño típico | Ejemplo |
|-------|---------------|---------|
| user_id | 4 bytes | `5` |
| action | ~8 bytes | `"UPDATE"` |
| entity_name | ~15 bytes | `"warehouses"` |
| entity_id | 4 bytes | `42` |
| old_values (JSONB) | ~50-500 bytes | `{"name": "Almacén A"}` |
| new_values (JSONB) | ~50-500 bytes | `{"name": "Almacén Principal"}` |
| ip_address | ~15 bytes | `"192.168.1.100"` |
| created_at | 8 bytes | timestamp |
| **Total estimado** | **~150-1100 bytes/registro** | |

**Impacto en tráfico de red:** Mínimo. Cada INSERT es parte de la misma transacción que la operación principal (o una transacción separada con `commit=True`). El overhead de red es despreciable comparado con la operación misma (~1-2% adicional).

**Frecuencia esperada:**
- Operaciones CRUD típicas: ~50-200 registros/día en producción normal
- Picos (migraciones, cargas masivas): ~1000-5000 registros/día
- Login/logout: ~100-500 registros/día

### 4.2 Lectura (Consulta)

El endpoint `GET /api/v2/audit-logs` es **admin-only**, por lo que el tráfico de lectura es mínimo:
- Solo accesible por administradores del sistema
- No hay consumo público ni desde técnicos/operadores
- Tampoco hay consumo desde el frontend general (solo página de auditoría)

**Patrón de consulta típico:** Un admin revisa auditoría 1-5 veces al día, páginas de 50 registros.

### 4.3 Veredicto Tráfico

**✅ Eficiente.** El sistema de auditoría agrega ~1-2% de overhead en escritura y <0.1% en lectura. No hay riesgo de impacto en performance por tráfico.

---

## 5. Análisis de Eficiencia — Almacenamiento

### 5.1 Tamaño por Registro

| Componente | Bytes | Notas |
|------------|-------|-------|
| Filas fijas (PK, FKs, timestamps) | ~60 | integers + datetime |
| Strings cortos (action, entity_name, status) | ~40 | varchar |
| JSONB `old_values` | ~50-500 | depende de cuántos campos cambien |
| JSONB `new_values` | ~50-500 | mismo que old en UPDATE |
| **Total típico** | **~200-1100** | por registro |
| **Total con overhead de página PostgreSQL** | **~2-4 KB** | incluye tuple header + alignment |

### 5.2 Proyección de Crecimiento

| Período | Registros/mes | Espacio estimado (con overhead) |
|---------|---------------|-------------------------------|
| 1 mes | ~5,000 | ~20 MB |
| 6 meses | ~30,000 | ~120 MB |
| 1 año | ~60,000 | ~240 MB |
| 3 años | ~180,000 | ~720 MB |
| 5 años | ~300,000 | ~1.2 GB |

### 5.3 JSONB — Ventajas y Desventajas

**Ventajas:**
- ✅ **Esquema flexible:** Cada entidad puede guardar distintos campos sin migraciones
- ✅ **Compacto:** PostgreSQL almacena JSONB en formato binario descompuesto, con diccionario de claves compartido
- ✅ **Indexable:** Se pueden crear índices GIN sobre JSONB si se necesita buscar dentro de los valores
- ✅ **Sin joins:** Los valores antes/después están en la misma fila

**Desventajas:**
- ⚠️ **No hay integridad referencial:** Los valores son "fotos" del momento, no referencias FK
- ⚠️ **No se pueden hacer JOINs** entre old_values y tablas actuales (son datos históricos)
- ⚠️ **Mayor espacio que columnas normalizadas** (~20-30% más), pero es intencional (datos históricos no deben normalizarse)

### 5.4 Estrategia de Retención Recomendada

Actualmente **no hay política de retención** (los registros viven para siempre).

| Prioridad | Acción | Impacto |
|-----------|--------|---------|
| 🔴 **ALTA** | Implementar TTL (Time-To-Live) de 2-3 años | Evita crecimiento ilimitado |
| 🟡 **MEDIA** | Crear partición por mes (`created_at`) | Facilita purge de datos viejos (DROP PARTITION) |
| 🟢 **BAJA** | Índice compuesto en `(entity_name, entity_id, created_at)` | Acelera consultas por entidad específica |

### 5.5 Veredicto Almacenamiento

**✅ Eficiente para el propósito.** ~200-500 bytes por registro es aceptable para auditoría. JSONB es la elección correcta para datos históricos con esquema variable. A 5 años se proyecta ~1.2 GB, que es trivial para PostgreSQL.

---

## 6. Problemas de Performance Identificados

### 🔴 PROBLEMA 1: COUNT() Ineficiente en Audit Endpoint

**Archivo:** [`backend/src/routers/audit.py:112`](backend/src/routers/audit.py:112)

```python
# ❌ Actual: Carga TODOS los IDs en memoria Python
count_stmt = select(AuditLog.id)
if filters:
    count_stmt = count_stmt.where(and_(*filters))
total = len(db.execute(count_stmt).scalars().all())
```

**Problema:** `scalars().all()` trae todos los IDs que coinciden con el filtro desde PostgreSQL a la memoria de Python, y luego cuenta con `len()`. En una tabla con 100,000 registros, esto significa transferir ~3 MB de datos de IDs solo para contar.

**Solución:**
```python
# ✅ Debe usar SELECT COUNT(*) nativo de PostgreSQL
from sqlalchemy import func

count_stmt = select(func.count(AuditLog.id))
if filters:
    count_stmt = count_stmt.where(and_(*filters))
total = db.scalar(count_stmt)  # Devuelve un solo entero
```

**Impacto de la corrección:**
- Sin filtros: reduce de O(n) en Python a O(1) en DB
- Con filtros: reduce de O(n) transferencia de datos a un solo entero
- En tabla con 50,000 registros: de ~1.5 MB transferidos a ~8 bytes

### 🟡 PROBLEMA 2: Falta de Índice en `created_at`

La tabla no tiene índice en `created_at`, que es el campo por el que se ordena siempre (`ORDER BY created_at DESC`). PostgreSQL termina haciendo sequential scan + sort para cada consulta.

**Solución:** Crear índice en `audit_logs.created_at DESC`.

### 🟡 PROBLEMA 3: No se pasa `ip_address` ni `user_agent`

Aunque el modelo soporta `ip_address` y `user_agent`, la mayoría de las llamadas a auditoría no los proveen. Esto limita la capacidad de rastrear desde dónde se hizo un cambio.

**Ejemplo en inventory.py:**
```python
log_create(
    db=db,
    user_id=current_user.id,
    entity_name="warehouses",
    entity_id=warehouse.id,
    new_values={"name": warehouse.name, "type": warehouse.type.value}
    # ❌ No pasa ip_address ni user_agent
)
```

---

## 7. Plan de Implementación para Cobertura Faltante

### 7.1 Priorización

| Prioridad | Módulo | Acciones a auditar | Esfuerzo estimado |
|-----------|--------|-------------------|-------------------|
| 🔴 **CRÍTICA** | Coordinación (Teams) | create, update, delete team + add/remove member + update role | ~30 min |
| 🔴 **ALTA** | Flota (Vehículos) | create, update, delete vehicle | ~20 min |
| 🟡 **MEDIA** | Performance (COUNT) | Fix en audit endpoint | ~5 min |
| 🟢 **BAJA** | Ingeniería | create, update, delete task | ~15 min |

### 7.2 Implementación: Coordinación (CRÍTICO)

**Archivos a modificar:**
1. [`backend/src/services/team_service.py`](backend/src/services/team_service.py) — Agregar imports y llamadas a auditoría
2. [`backend/src/routers/coordination.py`](backend/src/routers/coordination.py) — Pasar `current_user` al TeamService (o auditar desde el router)

**Estrategia recomendada:** Auditar desde el router (antes de llamar al service), ya que el router tiene acceso a `current_user` y puede pasar `ip_address`/`user_agent` desde el `request`.

```python
# En coordination.py - Auditoría desde el router
@router.post("/teams", ...)
def create_team(...):
    try:
        team = team_service.create_team(payload)
        log_create(
            db=db,
            user_id=current_user.id,
            entity_name="teams",
            entity_id=team.id,
            new_values={"name": team.name, ...}
        )
        return team
    except Exception as e:
        db.rollback()
        raise
```

### 7.3 Implementación: Flota Vehículos (ALTA)

**Archivo:** [`backend/src/routers/fleet.py`](backend/src/routers/fleet.py)

Ya importa `log_create` (línea 23). Solo necesita agregar:
- `log_create` en `create_vehicle()` (línea 63)
- `log_update` en `update_vehicle()` (línea 213) — cambiar import a `log_update`
- `log_delete` en `delete_vehicle()` (línea 280) — cambiar import a `log_delete`

```python
# En fleet.py, cambiar línea 23:
from src.utils.audit import log_create, log_update, log_delete, get_entity_dict
```

### 7.4 Implementación: Fix COUNT (MEDIA)

**Archivo:** [`backend/src/routers/audit.py`](backend/src/routers/audit.py)

```python
# Línea 112: Cambiar de:
count_stmt = select(AuditLog.id)
if filters:
    count_stmt = count_stmt.where(and_(*filters))
total = len(db.execute(count_stmt).scalars().all())

# A:
from sqlalchemy import func  # ← Agregar al import existente
count_stmt = select(func.count(AuditLog.id))
if filters:
    count_stmt = count_stmt.where(and_(*filters))
total = db.scalar(count_stmt) or 0
```

---

## 8. Resumen Ejecutivo

### Lo que funciona bien ✅
- **Arquitectura sólida:** Modelo de 3 capas (quién → qué entidad → qué cambió) con JSONB
- **Non-blocking:** Las fallas de auditoría nunca bloquean la operación principal
- **Admin-only:** El endpoint de consulta está correctamente protegido
- **Frontend completo:** Página de auditoría con filtros, paginación y detalle JSON
- **Utils reutilizables:** `log_create`, `log_update`, `log_delete` y `get_entity_dict` son consistentes

### Lo que falta 🔴
1. **Coordinación (Teams): CERO auditoría** — No queda registro de crear/modificar/eliminar cuadrillas, agregar/sacar técnicos, ni cambiar roles
2. **Vehículos (Flota): CERO auditoría en CRUD** — Solo las inspecciones diarias quedan registradas
3. **Ingeniería: CERO auditoría** — Tareas sin tracking de cambios

### Lo que hay que optimizar 🟡
4. **COUNT() ineficiente** en `get_audit_logs` — carga todos los IDs a Python solo para contar
5. **Falta índice en `created_at`** — ordenamiento sin soporte de índice
6. **Falta `ip_address`/`user_agent`** en la mayoría de llamadas de auditoría

### Proyección de almacenamiento
- Con cobertura completa (~10-15 registros/día): **~200 MB/año**
- PostgreSQL maneja esto sin esfuerzo hasta **10+ años**
- Recomendación: implementar TTL a 2-3 años o particionado por mes

### Conclusión

El motor de auditoría está **bien diseñado pero incompleto**. La arquitectura (JSONB, non-blocking, helpers reutilizables) es correcta y escalable. La deuda técnica principal es la **falta de cobertura en Coordinación y Flota**, que son precisamente los módulos donde las acciones del usuario tienen mayor impacto operativo (cambio de cuadrilla, asignación de vehículo, cambio de rol).

**La implementación de las 3 correcciones prioritarias (Coordinación + Flota + COUNT) está estimada en ~1 hora de trabajo efectivo.**
