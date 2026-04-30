# 🎯 Plan de Acción — Mejoras Estructurales de la API Emerald-ERP

> **Branch:** Creada por el usuario (lista para implementar)
> **Base:** [`backend/src/main.py`](backend/src/main.py) + todos los routers en [`backend/src/routers/`](backend/src/routers/)
> **Principio rector:** ✅ NO modificar Beholder (oráculo, auth X-API-Key, 4 pares bridge)
> **Documentación de referencia:** [`docs/AI_ARCHITECT_CONTEXT.md`](docs/AI_ARCHITECT_CONTEXT.md), [`docs/MASTER_CONTEXT.md`](docs/MASTER_CONTEXT.md), [`migracion_beholder_2026_maestra (1).md`](migracion_beholder_2026_maestra%20%281%29.md)

---

## Resumen de Cambios

| # | Mejora | Impacto | Archivos a modificar | Riesgo |
|---|--------|---------|---------------------|--------|
| 1 | **Estandarizar prefijos de routers** | 🔴 Alto | `main.py` + 5 routers | Medio — cambiar rutas puede romper frontend |
| 2 | **Estandarizar trailing slashes** | 🔴 Alto | `main.py` + todos los routers | Bajo — `redirect_slashes=True` es retrocompatible |
| 3 | **Unificar patrón de autenticación** | 🔴 Alto | `core/security.py`, `main.py`, 3 routers | Medio — cambiar dependencias |
| 4 | **Migrar lógica de coordinación desde work_orders.py** | 🟡 Medio | `work_orders.py`, `coordination.py`, frontend services | Alto — requiere cambios en frontend |
| 5 | **Agregar versionado v2 a inventory** | 🟢 Bajo | `inventory.py`, `main.py` | Bajo |
| 6 | **Unificar admin verify (API Keys + JWT)** | 🟢 Bajo | `main.py`, `audit.py` | Bajo |
| 7 | **Extraer validaciones comunes de CreateWorkOrder** | 🟢 Bajo | `tickets.py`, `work_orders.py` | Muy bajo |

---

## 🚫 Excluidos (NO tocar)

| Item | Razón | Documentación |
|------|-------|---------------|
| 4 pares de endpoints espejados (bridge Beholder) | Puente intencional entre Beholder↔Emerald | [`migracion_beholder_2026_maestra (1).md:194`](migracion_beholder_2026_maestra%20%281%29.md:194) |
| `_require_api_key` en oraculo.py | Beholder es independiente, X-API-Key es correcto | [`docs/AI_ARCHITECT_CONTEXT.md:61`](docs/AI_ARCHITECT_CONTEXT.md:61) |
| Search en tickets.py vs search.py | Diferentes consumidores (Emerald vs Beholder) | Análisis en [`plans/ANALISIS_ESTRUCTURA_API_EMERALD_ERP.md:130`](plans/ANALISIS_ESTRUCTURA_API_EMERALD_ERP.md:130) |
| CreateWorkOrder en tickets.py | Contextual (desde ticket) vs standalone | [`docs/ARQUITECTURA_TICKETS_V2.md:417`](docs/ARQUITECTURA_TICKETS_V2.md:417) |
| Oráculo con auth propio | Pertenece a Beholder, NO a Emerald | [`migracion_beholder_2026_codigo_anexos (1).md:1691`](migracion_beholder_2026_codigo_anexos%20%281%29.md:1691) |

---

## Paso 1: Estandarizar Prefijos de Routers

### Situación actual

Cada router sigue un patrón diferente:

| Router | Prefix actual (router) | Prefix en main.py | Ruta final |
|--------|----------------------|-------------------|------------|
| `work_orders` | `/v2/work-orders` | `/api` | `/api/v2/work-orders` ✅ correcta |
| `search` | *(ninguno)* | `/api` | `/api/search` ⚠️ sin v2 |
| `inventory` | `/inventory` | `/api` | `/api/inventory` ⚠️ sin v2 |
| `engineering` | `/api/v2/engineering` | *(ninguno)* | `/api/v2/engineering` ✅ ok |
| `coordination` | `/api/v2/coordination` | *(ninguno)* | `/api/v2/coordination` ✅ ok |
| `fleet` | `/api/v2/vehicles` | *(ninguno)* | `/api/v2/vehicles` ✅ ok |
| `fleet.inspection_router` | `/api/v2/fleet` | *(ninguno)* | `/api/v2/fleet` ✅ ok |
| `audit` | `/v2/audit-logs` | `/api` | `/api/v2/audit-logs` ✅ correcta |
| `installation_types` | *(desconocido)* | `/api` | varía |
| `tags` | *(ninguno)* | `/api/v2` | `/api/v2/tags` ✅ ok |

### Acción

**Objetivo:** Que TODOS los routers definan su prefijo completo en [`main.py`](backend/src/main.py) y los routers tengan `prefix=""` (o no definan prefix).

#### 1a. Modificar routers para que NO tengan prefix interno

| Archivo | Cambio |
|---------|--------|
| [`work_orders.py:45`](backend/src/routers/work_orders.py:45) | `router = APIRouter(tags=["work-orders"])` (quitar `prefix="/v2/work-orders"`) |
| [`search.py:13`](backend/src/routers/search.py:13) | `router = APIRouter(tags=["search"])` (actualmente sin prefix) |
| [`inventory.py:27`](backend/src/routers/inventory.py:27) | `router = APIRouter(tags=["inventory"])` (reemplazar `prefix="/inventory"`) |
| [`audit.py:19`](backend/src/routers/audit.py:19) | `router = APIRouter(tags=["Audit Logs"])` (quitar `prefix="/v2/audit-logs"`) |
| `installation_types.py` | `router = APIRouter(tags=["Installation"])` (verificar prefix actual) |

Los siguientes routers ya tienen el prefix completo internamente y NO tienen prefix en main.py — **no cambiarlos** (la ruta final ya es correcta):
- `engineering.py` — `prefix="/api/v2/engineering"` → correcto
- `coordination.py` — `prefix="/api/v2/coordination"` → correcto
- `fleet.py` — `prefix="/api/v2/vehicles"` → correcto
- `fleet.inspection_router` — `prefix="/api/v2/fleet"` → correcto
- `tags.py` — sin prefix interno, `main.py` pone `/api/v2` → correcto

#### 1b. Actualizar main.py con prefijos explícitos

En [`main.py`](backend/src/main.py), unificar el registro de TODOS los routers con prefijo completo:

```python
# Antes (inconsistente):
app.include_router(work_orders.router, prefix="/api", tags=["Work Orders"])
app.include_router(search.router, prefix="/api", tags=["Search"])
app.include_router(inventory.router, prefix="/api", tags=["Inventory"])
app.include_router(audit.router, prefix="/api", tags=["Audit Logs"])

# Después (consistente):
app.include_router(work_orders.router, prefix="/api/v2/work-orders", tags=["Work Orders"])
app.include_router(search.router, prefix="/api/v2/search", tags=["Search"])
app.include_router(inventory.router, prefix="/api/v2/inventory", tags=["Inventory"])
app.include_router(audit.router, prefix="/api/v2/audit-logs", tags=["Audit Logs"])
```

#### 1c. Verificar que ningún endpoint interno use rutas absolutas

Al cambiar prefixes, verificar que ningún decorador `@router.get(...)`, `@router.post(...)`, etc. use una ruta que empiece con `/` (ruta absoluta), lo que ignoraría el prefix del router.

Todos los routers actuales usan rutas relativas (sin `/` inicial o con `""`), por lo que este cambio es seguro.

#### 1d. Validar frontend

Buscar en [`frontend/src/services/`](frontend/src/services/) llamadas a los endpoints afectados y verificar que sigan apuntando a las mismas URLs finales.

---

## Paso 2: Estandarizar Trailing Slashes

### Situación actual

[`main.py:54`](backend/src/main.py:54): `redirect_slashes=False` — sin redirección automática entre `/endpoint` y `/endpoint/`.

Solo [`tickets.py:336-337`](backend/src/routers/tickets.py:336) maneja ambas variantes explícitamente (`@router.get("/")` y `@router.get("")`).

### Acción

**Opción recomendada:** Cambiar `redirect_slashes=True` en [`main.py:54`](backend/src/main.py:54).

Esto hace que FastAPI redirija automáticamente:
- `GET /api/v2/tickets` → `301 → GET /api/v2/tickets/`
- `GET /api/v2/tickets/` → `301 → GET /api/v2/tickets`

Es 100% retrocompatible — los clientes existentes seguirán funcionando, solo recibirán un redirect 307 en lugar de 404.

**Precaución:** Verificar que ningún frontend service dependa de NO recibir redirect (ej: Axios no sigue redirects por defecto). El frontend Emerald usa `axios` con `baseURL: "/api"` — Axios sigue redirects automáticamente por defecto, por lo que es seguro.

---

## Paso 3: Unificar Patrón de Autenticación (Emerald)

### Situación actual

Tres enfoques:
1. **Middleware** [`main.py:183-279`](backend/src/main.py:183): Decodifica JWT y setea `request.state.user_id` (string), pero NO resuelve el User completo
2. **`Depends(get_current_user)`** en [`core/security.py:165`](backend/src/core/security.py:165): Decodifica JWT **de nuevo** y resuelve User completo desde BD — usado por `work_orders.py`, `fleet.py`, `audit.py`, `coordination.py`
3. **`request.state.user_id`** leído directamente — usado por `tickets.py`, `engineering.py`, `inventory.py`

### Problema

Los routers del grupo 2 decodifican JWT dos veces (middleware + Depends). Los routers del grupo 3 no tienen el User completo disponible.

### Acción

#### 3a. Modificar middleware para resolver User completo

En [`main.py:261`](backend/src/main.py:261), después de decodificar el JWT, también resolver y setear `request.state.user`:

```python
# Después de la línea 261 (request.state.user_id = user_id_from_token)
# Resolver User completo y setear en request.state
try:
    db = SessionLocal()
    from src.repositories.user_repository import UserRepository
    user_repo = UserRepository(db)
    user = user_repo.get(int(user_id_from_token))
    if user:
        request.state.user = user
    db.close()
except Exception:
    pass  # Si falla, request.state.user no estará seteado
```

#### 3b. Crear dependencia unificada en core/security.py

Agregar una nueva dependencia que lea de `request.state`:

```python
async def get_current_user_from_state(request: Request) -> User:
    """Lee el User autenticado desde request.state (seteado por middleware)."""
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    return user
```

#### 3c. Migrar routers a la nueva dependencia

| Router | Cambio |
|--------|--------|
| [`work_orders.py:11`](backend/src/routers/work_orders.py:11) | `from src.core.security import get_current_user_from_state` + reemplazar `Depends(get_current_user)` |
| [`fleet.py:10`](backend/src/routers/fleet.py:10) | Idem |
| [`audit.py:13`](backend/src/routers/audit.py:13) | Idem (pero `get_current_admin_user` debe adaptarse) |
| [`coordination.py`](backend/src/routers/coordination.py) | Si usa `Depends(get_current_user)`, migrar también |

### Riesgo y mitigación

- **Riesgo:** Cambiar la dependencia puede romper endpoints que dependen del comportamiento exacto de `get_current_user()`
- **Mitigación:** Mantener AMBAS dependencias disponibles (`get_current_user` y `get_current_user_from_state`). Migrar de a un router por vez, probando cada uno.
- **Nota:** `get_current_user()` actual decodifica JWT del header, independientemente de lo que haya hecho el middleware. Si el middleware falla al setear `request.state.user`, el endpoint usaría la dependencia fallback.

---

## Paso 4: Migrar Lógica de Coordinación desde work_orders.py

### Situación actual

[`work_orders.py`](backend/src/routers/work_orders.py) contiene ~400 líneas de lógica de coordinación:
- Coordination grid (`get_coordination_grid`, línea 1221)
- Mark incomplete (línea 1115)
- Assign/unassign (líneas 1344, 1465)
- Contact attempts CRUD (líneas 1519-1688)

### Acción

1. Mover los endpoints de coordinación a [`coordination.py`](backend/src/routers/coordination.py)
2. Mantener un thin wrapper en `work_orders.py` que redirija (o eliminar si se actualiza el frontend)

**IMPORTANTE:** Las URLs cambiarían de `/api/v2/work-orders/...` a `/api/v2/coordination/...`. Esto requiere actualizar el frontend.

**Recomendación:** Hacer esto DESPUÉS de los pasos 1-3 (más riesgoso, posponer si es posible).

---

## Paso 5: Agregar Versionado v2 a Inventory

### Situación actual

[`inventory.py:27`](backend/src/routers/inventory.py:27): `prefix="/inventory"` → ruta final `/api/inventory` (sin `v2`)

### Acción

En [`main.py:127`](backend/src/main.py:127):

```python
# Antes:
app.include_router(inventory.router, prefix="/api", tags=["Inventory"])

# Después:
app.include_router(inventory.router, prefix="/api/v2/inventory", tags=["Inventory"])
```

**Precaución:** Verificar llamadas del frontend en [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js).

---

## Paso 6: Unificar Admin Verification

### Situación actual

- **API Key Management** en [`main.py:401`](backend/src/main.py:401): usa `verify_admin` que solo verifica `hasattr(request.state, "api_key_id")`
- **Audit logs** en [`audit.py:26`](backend/src/routers/audit.py:26): usa `get_current_admin_user` que verifica rol JWT

### Acción

Centralizar en `get_current_admin_user` de [`core/security.py`](backend/src/core/security.py):

```python
def get_current_admin_user(
    current_user: User = Depends(get_current_user_from_state)
) -> User:
    user_role = (current_user.role_name or "").lower()
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol admin")
    return current_user
```

Luego usar esta dependencia también en [`main.py`](backend/src/main.py) para los endpoints de API Key management.

---

## Paso 7: Extraer Validaciones Comunes de CreateWorkOrder (Opcional)

### Situación actual

- [`tickets.py:850`](backend/src/routers/tickets.py:850): `POST /{ticket_id}/work-orders` — contextual, crea timeline event
- [`work_orders.py:48`](backend/src/routers/work_orders.py:48): `POST /work-orders` — standalone, recibe ticket_id en payload

### Acción

Extraer validaciones comunes (ticket existence, estado válido, duplicados) a una función compartida en [`services/work_order_service.py`](backend/src/services/work_order_service.py):

```python
def validate_ticket_for_work_order(ticket_id: int, db: Session) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if ticket.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Estado inválido para crear OT")
    return ticket
```

---

## 📐 Diagrama de Estado Final Deseado

```mermaid
flowchart TD
    subgraph "main.py - Registro Unificado"
        PREFIX[Prefijos 100% en main.py\n/ routers sin prefix interno]
        SLASH[redirect_slashes=True\nredirección automática]
        AUTH[Middleware Auth Unificado\nJWT decode + User completo\n→ request.state.user]
    end

    subgraph "Routers Emerald - Consistente"
        TICKETS[/api/v2/tickets]
        WO[/api/v2/work-orders]
        SEARCH[/api/v2/search]
        TAGS[/api/v2/tags]
        ENG[/api/v2/engineering]
        COORD[/api/v2/coordination]
        FLEET[/api/v2/vehicles]
        FLEET2[/api/v2/fleet]
        INV[/api/v2/inventory]
        AUDIT[/api/v2/audit-logs]
        USERS[/api/v2/users]
        ROLES[/api/v2/roles]
    end

    subgraph "Dependencia Única de Auth"
        GET_USER[get_current_user_from_state\nlee de request.state.user\nsin re-decodificar JWT]
    end

    subgraph "Beholder - Sin cambios"
        ORACULO[/api/v1/oraculo\nX-API-Key propio]
        BRIDGE[/search /diagnosis /live\n+ espejos /api/*]
    end

    PREFIX --> TICKETS & WO & SEARCH & TAGS & ENG
    PREFIX --> COORD & FLEET & FLEET2 & INV & AUDIT
    PREFIX --> USERS & ROLES

    AUTH --> GET_USER
    GET_USER --> TICKETS & WO & SEARCH & TAGS
    GET_USER --> ENG & COORD & FLEET & INV & AUDIT

    BRIDGE -.->|Beholder| ORACULO
```

---

## Orden de Implementación Recomendado

```
Paso 1 (Prefijos) ──────┐
                         ├──→ Son independientes, se pueden
Paso 2 (Slashes) ───────┘   hacer en paralelo

Paso 3 (Auth) ────────── Depende de que los routers estén estables

Paso 5 (Inventory v2) ── Puede hacerse con Paso 1

Paso 6 (Admin unify) ─── Depende de Paso 3 (nueva dependencia)

Paso 7 (CreateWO) ────── Independiente, bajo riesgo

Paso 4 (Coordination) ── ⚠️ Solo si hay tiempo. Alto riesgo (frontend)
```

---

## Validación Post-Implementación

1. **Ejecutar tests existentes:** `cd backend && python -m pytest` (o el comando que uses)
2. **Verificar endpoints con curl:**
   ```bash
   curl -s http://localhost:8000/api/v2/tickets | head -5
   curl -s http://localhost:8000/api/v2/work-orders | head -5
   curl -s http://localhost:8000/api/inventory/products | head -5  # debe seguir funcionando hasta migrar frontend
   ```
3. **Verificar trailing slashes:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v2/tickets/
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v2/tickets
   # Ambos deben dar 200 (el segundo con redirect 307 si redirect_slashes=True)
   ```
4. **Verificar auth:**
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@emerald.com","password":"Admin2025"}' | jq -r '.access_token')
   curl -s http://localhost:8000/api/v2/work-orders -H "Authorization: Bearer $TOKEN" | head -5
   ```
5. **Verificar que Beholder sigue funcionando (sin auth):**
   ```bash
   curl -s http://localhost:8000/search?q=test
   curl -s http://localhost:8000/diagnosis/testuser
   ```
