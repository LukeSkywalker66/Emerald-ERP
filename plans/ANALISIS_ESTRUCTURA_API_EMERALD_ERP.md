# Análisis Estructural de la API de Emerald-ERP

> **Fecha:** 2026-04-28 (revisado 2026-04-29)
> **Propósito:** Revisión exhaustiva de endpoints, routers y patrones arquitectónicos para detectar duplicaciones innecesarias y oportunidades de optimización.
> **Alcance:** Backend FastAPI + Frontend API client.
> **Estado:** Solo análisis — no se modificó ningún archivo.
> **Documentación consultada:** [`docs/MASTER_CONTEXT.md`](docs/MASTER_CONTEXT.md), [`docs/AI_ARCHITECT_CONTEXT.md`](docs/AI_ARCHITECT_CONTEXT.md), [`docs/ARQUITECTURA_TICKETS_V2.md`](docs/ARQUITECTURA_TICKETS_V2.md), [`docs/AUTH_SYSTEM.md`](docs/AUTH_SYSTEM.md), [`migracion_beholder_2026_maestra (1).md`](migracion_beholder_2026_maestra%20%281%29.md), [`migracion_beholder_2026_codigo_anexos (1).md`](migracion_beholder_2026_codigo_anexos%20%281%29.md), [`00_SESION_ACTUAL_23_MARZO_2026.md`](00_SESION_ACTUAL_23_MARZO_2026.md)

---

## 1. Resumen Ejecutivo

La aplicación Emerald-ERP expone **~50+ endpoints REST** organizados en **12+ routers** con un esquema de versionado mixto (`/api/v1`, `/api/v2`, `/api` directo). Tras consultar la documentación del proyecto, se reclasificaron los hallazgos:

| Categoría | Cantidad | Impacto |
|-----------|----------|---------|
| Duplicaciones intencionales (Beholder legacy bridge) | 4 pares | ✅ Informacional — NO cambiar |
| Duplicaciones de lógica de negocio (contextual vs standalone) | 1 par | 🟢 Bajo — refactor menor opcional |
| Funcionalidades superpuestas (diferentes consumers) | 1 par | 🟢 Bajo — unificación opcional |
| Inconsistencias arquitectónicas (Emerald puro) | 5 hallazgos | 🟡🔴 Medio-Alto — priorizar |

---

## 2. Contexto Crítico: Beholder es un Sistema Independiente

La documentación revela que **Beholder NO es un módulo más de Emerald**, sino un sistema independiente embebido:

- **Frontend propio**: [`beholder_frontend/`](beholder_frontend/) es una app React+Vite+TypeScript separada
- **Auth propia**: usa `X-API-Key` header middleware, **sin JWT, sin usuarios, sin roles**
- **Sin autenticación de usuarios**: por diseño, es una herramienta de diagnóstico paralela que ya está en producción
- **Oráculo 2.0** ([`backend/src/routers/oraculo.py`](backend/src/routers/oraculo.py:19)) es el puente de integración: expone la funcionalidad de Beholder dentro de Emerald usando `_require_api_key` (NO JWT)

**Principio rector (de [`docs/AI_ARCHITECT_CONTEXT.md`](docs/AI_ARCHITECT_CONTEXT.md:6)):**
> ❌ NO mezclar legacy (Beholder) con nuevos diseños

Esto invalida o reclasifica varios hallazgos del análisis inicial.

---

## 3. Puente Beholder ↔ Emerald (NO cambiar)

### Endpoints espejados en [`backend/src/main.py`](backend/src/main.py:290)

Estos endpoints existen en **dos versiones**: ruta legacy (sin `/api`) para compatibilidad con el frontend Beholder, y ruta `/api/*` para Emerald. Son el **puente intencional** entre ambos sistemas.

| Ruta corta (Beholder) | Ruta larga (Emerald) | Línea |
|---------------------|---------------------|-------|
| [`GET /health`](backend/src/main.py:291) | [`GET /api/health`](backend/src/main.py:295) | 291-296 |
| [`GET /search?q=`](backend/src/main.py:298) | [`GET /api/search?q=`](backend/src/main.py:305) | 298-312 |
| [`GET /diagnosis/{pppoe_user}`](backend/src/main.py:315) | [`GET /api/diagnosis/{pppoe_user}`](backend/src/main.py:348) | 315-352 |
| [`GET /live/{pppoe_user}`](backend/src/main.py:354) | [`GET /api/live/{pppoe_user}`](backend/src/main.py:360) | 354-364 |

**Veredicto:** ✅ **NO cambiar.** Son el puente de integración. El frontend Beholder apunta a las rutas sin `/api`; Emerald apunta a las rutas con `/api`. Se podrán eliminar **solo cuando Beholder se migre completamente** a las rutas `/api/*` (post-2026 según [`migracion_beholder_2026_maestra (1).md`](migracion_beholder_2026_maestra%20%281%29.md)).

### Oráculo con auth propio (`_require_api_key`)

[`oraculo.py:19`](backend/src/routers/oraculo.py:19) implementa su propia validación `_require_api_key` que lee el header `X-API-Key`. Esto **NO** es una duplicación — es intencional:

- El middleware de [`main.py:183-279`](backend/src/main.py:183) tiene un whitelist que **NO incluye** `/api/v1/oraculo/*`
- Oráculo necesita aceptar X-API-Key (usado por Beholder frontend) y **NO tiene usuarios JWT**
- El middleware de main.py maneja API Keys para el ecosistema Emerald; oraculo.py maneja API Keys para Beholder

**Veredicto:** ✅ **NO cambiar.** Es correcto por diseño. No mezclar sistemas de auth.

---

## 4. Duplicaciones de Lógica de Negocio

### 4.1 `POST CreateWorkOrder` — Dos entradas, un propósito

| Endpoint | Router | Línea |
|----------|--------|-------|
| `POST /api/v2/tickets/{ticket_id}/work-orders` | [`tickets.py`](backend/src/routers/tickets.py:850) | 850-880 |
| `POST /api/v2/work-orders` | [`work_orders.py`](backend/src/routers/work_orders.py:48) | 48-93 |

**Análisis post-docs:**
- El endpoint en [`tickets.py`](backend/src/routers/tickets.py:850) es **contextual**: crea OT desde la vista de un ticket, generando automáticamente un `timeline_event` y heredando datos del ticket
- El endpoint en [`work_orders.py`](backend/src/routers/work_orders.py:48) es **standalone**: recibe `ticket_id` en el payload, puede crear OTs desde cualquier contexto
- Ambos usan [`create_work_order_for_ticket`](backend/src/services/work_order_service.py) en el service layer

**Veredicto:** 🟢 Bajo impacto. No es duplicación funcional — es dos **puntos de entrada** a la misma lógica compartida. Se puede optimizar extrayendo validaciones comunes a una función compartida, pero no eliminar ninguno.

### 4.2 Search / Search Connections

| Endpoint | Router | Línea | Consumidor |
|----------|--------|-------|------------|
| `GET /api/v2/tickets/search-connections` | [`tickets.py`](backend/src/routers/tickets.py:233) | 233-333 | Emerald frontend (enriquecido con ISPCube) |
| `GET /api/v2/search` | [`search.py`](backend/src/routers/search.py:35) | 35-81 | Beholder / Búsqueda simple |
| `GET /search` | [`main.py`](backend/src/main.py:298) | 298-312 | Beholder frontend (legacy, DB-only) |

**Análisis post-docs:**
- El endpoint de [`tickets.py`](backend/src/routers/tickets.py:233) soporta `source=db|ispcube|mixed` y filtra por estado/servicio/tecnología — es el buscador **enriquecido** para el frontend Emerald
- El endpoint de [`search.py`](backend/src/routers/search.py:35) busca solo en DB por nombre/documento — es el buscador **simple** que también usa Beholder
- El endpoint de [`main.py`](backend/src/main.py:298) es el puente legacy de Beholder

**Veredicto:** 🟢 Bajo impacto. Diferentes consumidores con diferentes necesidades. Se podría unificar en [`search.py`](backend/src/routers/search.py) como mejora de mantenibilidad, pero no hay duplicación funcional.

---

## 5. Inconsistencias Arquitectónicas (EMERALD — Priorizar)

Estos hallazgos afectan exclusivamente a los módulos **Emerald** (NO Beholder) y son los que realmente merecen optimización.

### 5.1 Registro de Prefijos Inconsistente

Cada router se registra en [`main.py`](backend/src/main.py) de manera diferente:

| Router | Prefix en main.py | Prefix propio | Ruta final | ¿Consistente? |
|--------|-------------------|---------------|------------|---------------|
| `tickets` | `/api/v2/tickets` | *(ninguno)* | `/api/v2/tickets/...` | ✅ |
| `work_orders` | `/api` | `/v2/work-orders` | `/api/v2/work-orders` | ⚠️ Doble prefix |
| `tags` | `/api/v2` | *(ninguno)* | `/api/v2/tags` | ✅ |
| `inventory` | `/api` | `/inventory` | `/api/inventory/...` | ⚠️ Sin `v2` |
| `engineering` | *(ninguno)* | `/api/v2/engineering` | `/api/v2/engineering/...` | ⚠️ Sin prefix en main |
| `coordination` | *(ninguno)* | `/api/v2/coordination` | `/api/v2/coordination/...` | ⚠️ Sin prefix en main |
| `fleet` | *(ninguno)* | `/api/v2/vehicles` | `/api/v2/vehicles/...` | ⚠️ Sin prefix en main |
| `fleet.inspection_router` | *(ninguno)* | `/api/v2/fleet` | `/api/v2/fleet/...` | ⚠️ Sin prefix en main |
| `search` | `/api` | `/v2/search` | `/api/v2/search` | ⚠️ Doble prefix |
| `audit` | `/api` | `/v2/audit-logs` | `/api/v2/audit-logs` | ⚠️ Doble prefix |
| `installation_types` | `/api` | `/v2/installation-types` | `/api/v2/installation-types` | ⚠️ Doble prefix |

**Problema:** 7/11 routers tienen registro inconsistente. Esto dificulta saber la ruta final sin inspeccionar ambos archivos. `inventory` ni siquiera tiene `v2`.

### 5.2 Trailing Slashes Inconsistentes

La app tiene [`redirect_slashes=False`](backend/src/main.py:54), lo que significa que **no hay redirección automática** entre `/endpoint` y `/endpoint/`.

**Problema:** Si un cliente llama a `/api/v2/tickets` (sin slash) y el router define `GET /` (con slash), obtendrá **404** en lugar de redirección. Solo [`tickets.py`](backend/src/routers/tickets.py:336) y [`work_orders.py`](backend/src/routers/work_orders.py:16) manejan ambas variantes parcialmente.

### 5.3 Patrones de Autenticación Mixtos (Emerald)

Tres enfoques diferentes para obtener el usuario autenticado en routers Emerald:

| Enfoque | Routers | Mecanismo |
|---------|---------|-----------|
| **`get_current_user()`** vía `Depends()` | `work_orders.py`, `fleet.py`, `audit.py` | Dependency injection que decodifica JWT directamente |
| **`request.state.user_id`** seteado por middleware | `tickets.py`, `tags.py`, `engineering.py`, `inventory.py` | Middleware en [`main.py:183-279`](backend/src/main.py:183) |
| **`request.state.user`** (objeto completo) | `coordination.py` | Middleware con resolución de BD |

**Problema:** El middleware de [`main.py:183-279`](backend/src/main.py:183) ya procesa autenticación (JWT + API Keys) y setea `request.state.user_id`. Sin embargo, algunos routers **ignoran este estado** y llaman a `get_current_user()` que hace **otra decodificación JWT duplicada** desde [`src/core/security.py`](backend/src/core/security.py). Esto es ineficiente y puede causar inconsistencias si el middleware y `get_current_user()` no usan exactamente la misma lógica.

**Nota:** Esto NO aplica a [`oraculo.py`](backend/src/routers/oraculo.py) que correctamente usa `_require_api_key`.

### 5.4 Lógica de Coordinación Fuera de Lugar

El router [`work_orders.py`](backend/src/routers/work_orders.py) contiene **~400 líneas** de lógica que pertenece conceptualmente al módulo de Coordinación:

- **[`get_coordination_grid`](backend/src/routers/work_orders.py:1221)** — dashboard de coordinación con equipos y OTs (líneas 1221-1341)
- **[`mark_work_order_incomplete`](backend/src/routers/work_orders.py:1115)** — lógica de coordinación para OTs incompletas (líneas 1115-1182)
- **[`assign_work_order_to_team`](backend/src/routers/work_orders.py:1344)** y **[`unassign`](backend/src/routers/work_orders.py:1465)** — asignación/desasignación a equipos (líneas 1344-1512)
- **[Contact attempts](backend/src/routers/work_orders.py:1519)** — CRUD completo de intentos de contacto (líneas 1519-1688)

Mientras tanto, [`coordination.py`](backend/src/routers/coordination.py:1) solo tiene CRUD de equipos (~300 líneas). La lógica de coordinación real está fragmentada.

### 5.5 Admin API Keys vs Admin basado en JWT

Dos sistemas de administración separados con diferentes mecanismos de auth:

| Sistema | Ubicación | Mecanismo |
|---------|-----------|-----------|
| **API Key Management** | [`main.py:401-552`](backend/src/main.py:401) | Dependencia `verify_admin` (solo verifica existencia de API Key en request.state) |
| **Audit Logs Admin** | [`audit.py:26-58`](backend/src/routers/audit.py:26) | `get_current_admin_user` (decodifica JWT + verifica rol `admin`) |

**Problema:** No hay un mecanismo unificado de "es admin". El API Key management solo verifica que haya una API Key, no que sea de un admin real.

---

## 6. Resumen de Hallazgos (Revisado)

### 🔴 Alto Impacto — Prioridad 1

| # | Hallazgo | Archivos | Acción Propuesta |
|---|----------|----------|-----------------|
| 1 | **Prefijos inconsistentes** — 7/11 routers con patrón no estandarizado | [`main.py`](backend/src/main.py), routers varios | Unificar todos los prefixes en main.py |
| 2 | **Trailing slashes no estandarizados** — con `redirect_slashes=False`, causa 404s | Todos los routers | Estandarizar slashes o cambiar a `redirect_slashes=True` |
| 3 | **Auth patterns mixtos** — doble decodificación JWT en routers Emerald | Varios routers | Unificar en una sola dependencia que lea de request.state |

### 🟡 Medio Impacto — Prioridad 2

| # | Hallazgo | Archivos | Acción Propuesta |
|---|----------|----------|-----------------|
| 4 | **Lógica de coordinación en work_orders.py** — grid, assign, contact attempts fuera de lugar | [`work_orders.py:1092-1688`](backend/src/routers/work_orders.py:1092) | Migrar a coordination.py |
| 5 | **Admin API Keys sin verificación real de admin** — `verify_admin` es placeholder | [`main.py:401`](backend/src/main.py:401) | Unificar con `get_current_admin_user` |

### 🟢 Bajo Impacto — Prioridad 3 (Opcional)

| # | Hallazgo | Archivos | Acción Propuesta |
|---|----------|----------|-----------------|
| 6 | **Inventory sin versionado `v2`** — único módulo sin prefijo v2 | [`inventory.py`](backend/src/routers/inventory.py) | Agregar `/v2/inventory` |
| 7 | **CreateWorkOrder duplicado** — dos puntos de entrada a misma lógica | [`tickets.py:850`](backend/src/routers/tickets.py:850), [`work_orders.py:48`](backend/src/routers/work_orders.py:48) | Extraer validaciones comunes |
| 8 | **Search en dos routers** — tickets.search-connections vs search.py | [`tickets.py:233`](backend/src/routers/tickets.py:233), [`search.py:35`](backend/src/routers/search.py:35) | Centralizar opcional en search.py |

### ✅ NO CAMBIAR — Confirmado por documentación

| # | Hallazgo previo | Razón |
|---|-----------------|-------|
| ~~7~~ | ~~4 pares de endpoints espejados~~ | Puente intencional Beholder↔Emerald |
| ~~8~~ | ~~Oráculo con auth propio~~ | Beholder es independiente, X-API-Key es correcto |
| ~~4/5~~ | ~~Search/CreateWorkOrder duplicados~~ | Diferentes consumidores, diferentes contextos |

---

## 7. Diagrama de Arquitectura Actual (con demarcación Beholder vs Emerald)

```mermaid
flowchart TD
    subgraph "EMERALD ERP"
        FE[Emerald Frontend\nbaseURL: /api\nJWT + Roles]
        
        subgraph "main.py - Middleware"
            SM[Security Middleware\nJWT + API Keys\nsetea request.state]
            AKM[Admin API Keys\nCRUD en main.py\nverify_admin placeholder]
        end

        subgraph "V2 Routers - Emerald"
            TICKETS[/api/v2/tickets\nsearch-connections + create_wo]
            WO[/api/v2/work-orders\ncreate_wo + grid + assign + contact]
            SEARCH[/api/v2/search\nbúsqueda simple DB]
            TAGS[/api/v2/tags]
            ENG[/api/v2/engineering]
            COORD[/api/v2/coordination\nCRUD equipos]
            FLEET[/api/v2/vehicles + /api/v2/fleet]
            INV[/api/inventory\nsin v2]
            AUDIT[/api/v2/audit-logs\nadmin JWT]
            INST[/api/v2/installation-types]
            USERS[/api/v2/users]
            ROLES[/api/v2/roles]
        end
        
        FE --> SM
        SM --> TICKETS & WO & SEARCH & TAGS
        SM --> ENG & COORD & FLEET & INV
        SM --> AUDIT & INST & USERS & ROLES
    end

    subgraph "BEHOLDER - Sistema Independiente"
        BH_FE[Beholder Frontend\nReact+TS\nSin JWT]
        BH_API[Beholder API\nbeholder_frontend/\nX-API-Key Middleware]
        
        subgraph "Puente de Integración"
            ORACULO[/api/v1/oraculo\ntrafico, sesiones\ntrafico-pppoe, debug\n_require_api_key]
            BRIDGE[/search /diagnosis /live\n+ espejos /api/*\nen main.py]
        end
        
        BH_FE --> BH_API
        BH_FE --> BRIDGE
        BH_FE --> ORACULO
    end
```

---

## 8. Conclusión

La API de Emerald-ERP tiene **pocas duplicaciones innecesarias reales**. Los hallazgos iniciales se reclasificaron tras consultar la documentación del proyecto:

1. **Beholder es independiente** — sus endpoints, auth y frontend son separados. No tocarlos.
2. **El puente Beholder↔Emerald** (4 pares de endpoints) es intencional. Mantener.
3. **Las inconsistencias reales** están en los módulos Emerald: prefixes, trailing slashes, auth patterns y lógica de coordinación fuera de lugar.
4. **Las duplicaciones de lógica** (CreateWorkOrder, Search) son dos caras de la misma moneda, para diferentes consumidores.

**Las mejoras con mejor relación esfuerzo/impacto son:**
- 🔴 **Prefix standardization** (main.py + routers)
- 🔴 **Auth pattern unification** (eliminar doble decodificación JWT)
- 🟡 **Move coordination logic** (work_orders.py → coordination.py)

---

## 9. Documentación Consultada

| Documento | Contenido Clave |
|-----------|-----------------|
| [`docs/MASTER_CONTEXT.md`](docs/MASTER_CONTEXT.md) | Full project reference: stack, models, endpoints, guard rails, audit system |
| [`docs/AI_ARCHITECT_CONTEXT.md`](docs/AI_ARCHITECT_CONTEXT.md) | ✅ NO mezclar legacy (Beholder) con nuevos diseños. Clean Slate pattern |
| [`docs/ARQUITECTURA_TICKETS_V2.md`](docs/ARQUITECTURA_TICKETS_V2.md) | Tickets: 3 tablas, connection enrichment, timeline inmutable, WO closure flow |
| [`docs/AUTH_SYSTEM.md`](docs/AUTH_SYSTEM.md) | JWT HS256 + Argon2, roles admin/tecnico/viewer, 30-min token |
| [`migracion_beholder_2026_maestra (1).md`](migracion_beholder_2026_maestra%20%281%29.md) | Oráculo 2.0: 4 endpoints, retry+backoff, cache TTL, X-API-Key auth |
| [`migracion_beholder_2026_codigo_anexos (1).md`](migracion_beholder_2026_codigo_anexos%20%281%29.md) | Código completo: oraculo_router.py, config, smartolt, diagnosis, sync |
| [`00_SESION_ACTUAL_23_MARZO_2026.md`](00_SESION_ACTUAL_23_MARZO_2026.md) | Last session notes: tooling fix, role inconsistency operador vs operator |
