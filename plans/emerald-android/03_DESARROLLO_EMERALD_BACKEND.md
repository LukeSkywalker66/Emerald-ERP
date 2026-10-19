# 03 — Desarrollo Necesario en Emerald (Backend) para Integrar con la App

Cambios a realizar en el repo actual de Emerald para que la app Android funcione a la perfección. Cada ítem incluye contrato propuesto.

## 1. Sincronización incremental (fundamental para offline)

Problema: `GET /api/v2/work-orders` es paginado y no permite traer solo lo que cambió desde la última sync.

### Propuesta

`GET /api/v2/work-orders/sync?updated_since=<ISO8601>&limit=&offset=`

Respuesta:

```json
{
  "items": [],
  "deleted_ids": [],
  "server_time": "2026-10-17T14:00:00Z",
  "has_more": false
}
```

- `updated_since`: cursor de última sincronización.
- `deleted_ids`: IDs borrados/anulados desde la última sync (para purgar en el device).
- Aplica el mismo scope por rol/capability que [`list_work_orders`](backend/src/routers/work_orders.py:156).
- Requiere que `WorkOrder` tenga `updated_at` poblado en cada cambio (verificar/agregar `onupdate`).

## 2. Presigned uploads a MinIO para fotos

Problema: hoy la foto va por multipart a FastAPI y de ahí a MinIO (doble tránsito; malo en redes pobres).

### Propuesta

`POST /api/v2/work-orders/{id}/photo-upload-url`

Request: `{ "filename": "evidencia.jpg", "content_type": "image/jpeg", "size": 123456 }`

Response:

```json
{
  "upload_url": "https://minio.../presigned...",
  "object_key": "wo/{id}/uuid_evidencia.jpg",
  "file_url": "/api/v2/tickets/{ticket_id}/attachments/{attachment_id}/file"
}
```

- El device sube directo a MinIO con PUT y luego referencia `file_url` al cerrar la OT (campo `photo_urls` de [`complete`](backend/src/routers/work_orders.py:3190)).
- Alternativa si no se quiere presigned: mantener multipart actual (más simple, aceptable en fase 1).

## 3. Notificaciones push (FCM)

### 3.1 Registro de dispositivo

`POST /api/v2/devices` — registrar token FCM por usuario.

Request: `{ "fcm_token": "...", "platform": "android", "app_version": "1.0.0" }`

`DELETE /api/v2/devices/{token}` — desregistrar en logout.

Nueva tabla `user_devices`: `id`, `user_id`, `fcm_token` (único), `platform`, `app_version`, `created_at`, `last_seen_at`.

### 3.2 Envío de notificaciones

- Servicio `notification_service` que envía FCM cuando ocurren eventos: OT asignada a cuadrilla, cambio de estado, reasignación, OT vencida.
- Se puede disparar desde los mismos routers (ej. [`assign_work_order_to_team`](backend/src/routers/work_orders.py:2838)) o desde Celery.
- Payload mínimo:

```json
{
  "title": "Nueva OT asignada",
  "body": "OT #1234 - Soporte",
  "data": { "work_order_id": "1234", "type": "assignment" }
}
```

## 4. Política de sesión para dispositivos

- Decidir entre:
  - **Refresh token de larga duración** específico para móvil (revocable), o
  - **Token de dispositivo** (API key por device) con rotación.
- Agregar `GET /api/v1/auth/me` ya existente como fuente de capabilities; la app debe cachear capabilities para UI offline.
- Endpoint de revocación remota: `POST /api/v1/auth/revoke-device` (para robo/baja).

## 5. Tracking opcional de posición (no bloqueante)

Si se quiere ver al técnico en el mapa desde coordinación:

`POST /api/v2/work-orders/{id}/location` — `{ "latitude": ..., "longitude": ..., "accuracy_m": ..., "recorded_at": ... }`

- Guardar en tabla `technician_locations` (o `work_order_updates`).
- Respetar privacidad: solo mientras la OT está `in_progress`.

## 6. Endpoints menores de soporte

- `GET /api/v2/work-orders/meta` — catálogo consolidado de tipos de OT, acciones de cierre y categorías de resolución en una sola llamada (evita N requests en el wizard de cierre).
- Confirmar que `PATCH /{id}` acepta `latitude`/`longitude` para actualizar ubicación offline (hoy la web usa `UpdateLocationModal`).

## 7. Ajustes de modelo/schema (si aplican)

- Garantizar `updated_at` con `onupdate=now()` en `WorkOrder` para la sync incremental.
- Migración Alembic para `user_devices` (y `technician_locations` si se adopta).
- Índice en `(team_id, status)` y `(technician_id, status)` para las consultas de sync/agenda.

## 8. Orden de trabajo sugerido en el backend

1. Sync incremental + `updated_at` (habilita el núcleo offline).
2. Presigned uploads (mejora subida de fotos en calle).
3. `user_devices` + FCM (notificaciones).
4. `work-orders/meta` (simplifica wizard).
5. Tracking de posición (opcional, último).

Todo se trabaja en el repo actual de Emerald; el móvil consume el contrato OpenAPI regenerado.
