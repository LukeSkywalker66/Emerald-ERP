# 02 — Documentación de Emerald Requerida para la Integración

Este documento consolida qué documentación y datos de Emerald se necesitan para desarrollar la app Android sin ambigüedades.

## 1. Contrato de API (fuente de verdad)

- Exportar el esquema OpenAPI del backend: `GET /openapi.json` (FastAPI lo genera automático, ver [`main.py`](backend/src/main.py:58)).
- Versionar el contrato (tag/commit) para que el móvil sepa contra qué API compila.
- Generar cliente Kotlin/DTOs con OpenAPI Generator o KSP.

## 2. Endpoints que consume la app

### 2.1 Autenticación

| Endpoint | Método | Uso | Referencia |
|----------|--------|-----|------------|
| `/api/v1/auth/login` | POST | Login OAuth2 (form-urlencoded) | [`auth.py`](backend/src/routers/v1/auth.py:47) |
| `/api/v1/auth/refresh` | POST | Renovar access token | [`auth.py`](backend/src/routers/v1/auth.py:147) |
| `/api/v1/auth/me` | GET | Perfil + capabilities RBAC | [`auth.py`](backend/src/routers/v1/auth.py:223) |

### 2.2 Work Orders (`/api/v2/work-orders`)

| Endpoint | Método | Uso |
|----------|--------|-----|
| `` (raíz) | GET | Listado con filtros y scope por rol |
| `/my-schedule` | GET | Agenda del día |
| `/my-pending-closure` | GET | OTs vencidas que bloquean |
| `/{id}` | GET | Detalle completo |
| `/{id}` | PATCH | Iniciar/actualizar |
| `/{id}/items` | POST | Agregar material |
| `/{id}/items/{item_id}` | DELETE | Quitar material |
| `/{id}/recovery` | POST | Recuperación de equipos |
| `/updates/pending` | GET | Novedades pendientes |
| `/{id}/updates` | GET/POST | Novedades de OT |
| `/updates/{update_id}/status` | PATCH | Estado de novedad |
| `/{id}/reopen` | PUT | Reabrir |
| `/{id}/cancel` | POST | Anular (con motivo) |
| `/{id}/cancel-start` | POST | Cancelar inicio |
| `/{id}/mark-incomplete` | POST | Marcar no realizada |
| `/{id}/contact-attempts` | GET/POST | Intentos de contacto |
| `/{id}/contact-attempts/stats` | GET | Estadísticas de contacto |
| `/{id}/complete` | POST | Cierre transaccional |
| `/{id}/connection-assets` | GET | Activos de conexión |
| `/{id}/connection-notes` | GET | Notas de conexión |
| `/connection-notes` | POST | Crear nota de conexión |

Todos definidos en [`work_orders.py`](backend/src/routers/work_orders.py:88).

### 2.3 Soporte

| Endpoint | Método | Uso | Referencia |
|----------|--------|-----|------------|
| `/api/v2/tickets/{id}/attachments` | POST | Subir foto (multipart → MinIO) | [`tickets_v2_attachment.py`](backend/src/routers/tickets_v2_attachment.py:48) |
| `/api/v2/tickets/{id}/attachments/{att_id}/file` | GET | Descargar foto | [`tickets_v2_attachment.py`](backend/src/routers/tickets_v2_attachment.py:176) |
| `/api/v2/work-order-types` | GET | Tipos de OT y acciones de cierre | [`work_order_types.py`](backend/src/routers/work_order_types.py) |
| `coordination` (teams) | GET | Cuadrillas del usuario | [`main.py`](backend/src/main.py:181) |
| `fleet` (vehículos/inspecciones) | GET/POST | Inspección diaria de vehículo | [`main.py`](backend/src/main.py:187) |
| `/diagnosis/{pppoe}` | GET | Diagnóstico Beholder | [`beholder.service.js`](frontend/src/services/beholder.service.js:30) |

## 3. Diccionario de datos a documentar

### 3.1 WorkOrder (`[`tickets.py`](backend/src/models/tickets.py)`)

- Campos: `id`, `ticket_id`, `ot_type`, `status`, `priority`, `scheduled_start`, `scheduled_at`, `started_at`, `completed_at`, `cancelled_at`, `technician_id`, `team_id`, `latitude`, `longitude`, `notes`, `operational_instruction`, `custom_data` (JSONB), `close_idempotency_key`, `resolution_category`, `resolution_notes`, `photo_urls`.

### 3.2 `ticket_info` (armado en [`get_work_order_detail`](backend/src/routers/work_orders.py:485))

Estructura que recibe la app en el detalle: `id`, `subject`, `description`, `connection_id`, `priority`, `category_name`, `reason_name`, `client_name`, `address`, `address_parts` (calles, barrio, ciudad, CP), `client_dni`, `contact_phone`, `pppoe_username`, `node_name`, `node_ip`, `vlans`, `plan_name`, `plan_speed`.

### 3.3 `custom_data` (JSONB)

- `connection`: snapshot del cliente/conexión al crear la OT.
- `internal_subtype`: subtipo para OTs internas (postes, fibra, NAP, nodo, torre, power, office, other).

### 3.4 Enums/estados

- `WorkOrderStatus`: `pending_planning`, `assigned`, `in_progress`, `pending_closure`, `completed`, `failed`, `cancelled`.
- `WorkOrderType`: `repair`, `install_ftth`, `install_aire`, `pickup`, `infrastructure`, `install`, etc. (ver [`migrate`](backend/alembic/versions/2026_06_07_001_seed_work_order_types.py)).
- `ResolutionCategory`: incluye `incomplete` para "no realizada".
- Prioridades: `critical`, `high`, `medium`, `low`.

## 4. Reglas de negocio a codificar en la app

1. **Scope por rol:** el técnico ve sus OTs + las de sus cuadrillas (aplica [`build_capabilities`](backend/src/core/security.py:395) y el filtro de [`list_work_orders`](backend/src/routers/work_orders.py:156)).
2. **Bloqueo `pending_closure`:** no puede iniciar tareas nuevas si tiene una OT vencida sin cerrar (ver [`get_my_pending_closure`](backend/src/routers/work_orders.py:353)).
3. **Inspección de vehículo:** bloqueo duro si la cuadrilla tiene vehículo sin inspección diaria (fleet).
4. **Grace period:** OT vencida = `scheduled_start` anterior a 5 minutos (ver [`WorkOrderExecutionPage.jsx`](frontend/src/pages/WorkOrderExecutionPage.jsx:367)).
5. **Cierre:** acción de resolución (WO Actions dinámicas por tipo), narrativa mínima, fotos obligatorias para install/repair, materiales consumidos.
6. **Inventario:** bulk vs. serializado, derivación de `warehouse_id`, reversión de ítems al reabrir (ver [`wo_completion_service`](backend/src/services/wo_completion_service.py)).
7. **Idempotencia:** `close_idempotency_key` evita doble consumo de inventario (ver [`complete_work_order`](backend/src/routers/work_orders.py:3253)).

## 5. Convenciones y entornos

- Formato de errores: `{"detail": "..."}` con status HTTP estándar (401/403/404/409/422/423).
- Lock codes: header `x-locked-reason` (`LOCKED_PAST_DATE`, `LOCKED_COMPLETED`, `LOCKED_CANCELLED`).
- URLs por ambiente (dev/staging/prod) y cómo llega el device (VPN/DDNS/dominio público).
- Variables de entorno relevantes del backend (`.env.example`).
- TZ: `America/Argentina/Buenos_Aires`.

## 6. Checklist de relevamiento pendiente (a completar con el equipo Emerald)

- [ ] Lista definitiva de tipos de OT y sus WO Actions activas.
- [ ] Catálogo exacto de `ResolutionCategory` y mapeo de action codes.
- [ ] Reglas de inventario (qué ítems exigen serial, cuáles van por bulk).
- [ ] Política de fotos (cantidad mínima/máxima, peso, formatos).
- [ ] Reglas de `pending_closure` y de inspección de vehículo (frecuencia, excepciones).
- [ ] TTLs reales de access/refresh tokens.
- [ ] Datos de ejemplo en dev para probar todos los flujos.
