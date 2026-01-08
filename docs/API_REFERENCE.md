# 📖 API Reference - Emerald ERP

Documentación completa de todos los endpoints disponibles en la API de Emerald ERP.

**Base URL:** `http://localhost/api` (desarrollo) o `https://emerald.2finternet.ar/api` (producción)

---

## 🔐 Autenticación

### Sistema de API Keys (NUEVO - 30/12/2025)

La API usa un sistema profesional de API Keys con rotación automática.

**Documentación completa:** [SEGURIDAD.md](SEGURIDAD.md) | [API_KEYS.md](API_KEYS.md)

### Usar API Key

Todos los endpoints **excepto los públicos** requieren un header de API Key:

```bash
curl -X GET "http://localhost/api/clientes" \
  -H "x-api-key: iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
```

### Crear una API Key

```bash
# Requiere autenticación admin
curl -X POST "http://localhost/admin/api-keys" \
  -H "x-api-key: ${EXISTING_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Integración",
    "scopes": ["read", "write"],
    "expires_in_days": 90
  }'
```

**Importante:** La key se devuelve UNA SOLA VEZ. Guardarla inmediatamente.

### Endpoints Públicos (Sin API Key)
- `GET /health`
- `GET /search`
- `GET /diagnosis/{pppoe_user}`
- `GET /live/{pppoe_user}`

### Endpoints Admin de Gestión (Requieren autenticación)

| Método | Path | Descripción |
|--------|------|------------|
| POST | `/admin/api-keys` | Crear nueva key |
| GET | `/admin/api-keys` | Listar todas |
| POST | `/admin/api-keys/{id}/rotate` | Rotar manualmente |
| DELETE | `/admin/api-keys/{id}` | Revocar |
| GET | `/admin/api-keys/{id}/audit` | Auditoría de key |
| GET | `/admin/api-keys/audit/all` | Auditoría de todas |

---

## 📋 Tickets (CRM)

### GET /tickets
Obtener lista de todos los tickets de soporte.

**Autenticación:** Requerida  
**Método:** GET  
**URL:** `/tickets`

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Internet lento",
    "description": "El cliente reporta velocidad muy baja",
    "priority": "high",
    "status": "open",
    "category": "network",
    "created_at": "2025-12-30T10:30:00Z",
    "service": {
      "id": 5,
      "ip_address": "192.168.100.50",
      "installation_address": "Calle 123, Piso 2",
      "client": {
        "name": "Juan Pérez",
        "phone": "1234567890",
        "billing_address": "Calle 123, Piso 2"
      },
      "plan": {
        "name": "Plan 50MB",
        "bandwidth_down": 50,
        "bandwidth_up": 10
      }
    }
  }
]
```

**Códigos de Error:**
- `401` - API Key inválida
- `500` - Error interno del servidor

---

### POST /tickets
Crear un nuevo ticket de soporte.

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/tickets`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "title": "Internet cortado",
  "description": "El servicio no responde",
  "priority": "critical",
  "service_id": 5
}
```

**Campos:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|------------|
| `title` | string | ✅ | Título del problema |
| `description` | string | ✅ | Descripción detallada |
| `priority` | string | ✅ | `low`, `medium`, `high`, `critical` |
| `service_id` | integer | ✅ | ID del servicio/cliente |

**Response (200):**
```json
{
  "id": 42,
  "title": "Internet cortado",
  "description": "El servicio no responde",
  "priority": "critical",
  "status": "open",
  "category": null,
  "created_at": "2025-12-30T14:45:00Z",
  "service": { ... }
}
```

**Códigos de Error:**
- `400` - Validación fallida
- `404` - Servicio no encontrado
- `401` - API Key inválida

---

## 🔗 Servicios (Clientes)

### GET /services_options
Obtener lista de todos los servicios/conexiones activas.

**Autenticación:** Requerida  
**Método:** GET  
**URL:** `/services_options`

**Response (200):**
```json
[
  {
    "id": 5,
    "ip_address": "192.168.100.50",
    "installation_address": "Calle 123, Piso 2",
    "client": {
      "name": "Juan Pérez",
      "phone": "1234567890",
      "billing_address": "Calle 123, Piso 2"
    },
    "plan": {
      "name": "Plan 50MB",
      "bandwidth_down": 50,
      "bandwidth_up": 10
    }
  }
]
```

**Query Parameters:** Ninguno

**Códigos de Error:**
- `401` - API Key inválida

---

## 🔍 Búsqueda

### GET /search
Buscar clientes unificando múltiples fuentes (ISPCube, Mikrotik, SmartOLT).

**Autenticación:** NO requerida (Público)  
**Método:** GET  
**URL:** `/search?q=juan`

**Query Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|------------|
| `q` | string | ✅ | Término de búsqueda (nombre, IP, username) |

**Response (200):**
```json
{
  "ispcube": [
    {
      "pppoe": "juan_perez",
      "nombre": "Juan Pérez",
      "direccion": "Calle 123, Piso 2",
      "id": 12345,
      "origen": "ispcube",
      "nodo_ip": "192.168.1.100",
      "nodo_nombre": "Router Principal"
    }
  ],
  "mikrotik": [
    {
      "pppoe": "juan_perez",
      "nombre": "No Vinculado",
      "direccion": "IP: 192.168.1.100",
      "id": 0,
      "origen": "mikrotik",
      "nodo_ip": "192.168.1.100",
      "nodo_nombre": "Router 192.168.1.100"
    }
  ]
}
```

**Códigos de Error:**
- `500` - Error en consulta a bases de datos

---

## 🏥 Diagnóstico

### GET /diagnosis/{pppoe_user}
Obtener diagnóstico completo de un cliente (estado en BD, Mikrotik, SmartOLT).

**Autenticación:** NO requerida (Público)  
**Método:** GET  
**URL:** `/diagnosis/juan_perez?ip=192.168.1.100`

**URL Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|------------|
| `pppoe_user` | string | ✅ | Usuario PPPoE a diagnosticar |
| `ip` | string | ❌ | IP del router Mikrotik (opcional) |

**Response (200):**
```json
{
  "pppoe_username": "juan_perez",
  "nombre_cliente": "Juan Pérez",
  "plan_velocidad": "50 Mbps",
  "estado_conexion": "active",
  "nodo_ip": "192.168.1.100",
  "unique_external_id": "ONU_ABCD1234",
  
  "mikrotik": {
    "active": true,
    "current_address": "192.168.100.50",
    "uptime": "5d 12h 30m",
    "identity": "PPPoE_Session_12345"
  },
  
  "onu_status_smrt": {
    "status": "online",
    "olt_id": "OLT_001",
    "onu_id": 128
  },
  
  "onu_signal_smrt": {
    "rx_power": -20.5,
    "tx_power": 2.3,
    "distance": 12850
  }
}
```

**Respuesta de Error (404):**
```json
{
  "detail": "Cliente no encontrado"
}
```

**Códigos de Error:**
- `404` - Cliente no encontrado
- `500` - Error en consulta a Mikrotik o SmartOLT

---

### GET /live/{pppoe_user}
Obtener tráfico en tiempo real de un usuario.

**Autenticación:** NO requerida (Público)  
**Método:** GET  
**URL:** `/live/juan_perez`

**URL Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|------------|
| `pppoe_user` | string | ✅ | Usuario PPPoE |

**Response (200):**
```json
{
  "status": "success",
  "pppoe_user": "juan_perez",
  "bytes_in": 1048576000,
  "bytes_out": 524288000,
  "packets_in": 2500000,
  "packets_out": 1800000,
  "timestamp": "2025-12-30T14:45:00Z"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "detail": "Usuario no conectado o no disponible"
}
```

**Códigos de Error:**
- `500` - Error en consulta a Mikrotik

---

## ❤️ Health Check

### GET /health
Verificar salud de la API.

**Autenticación:** NO requerida (Público)  
**Método:** GET  
**URL:** `/health`

**Response (200):**
```json
{
  "status": "ok",
  "system": "Emerald Core + Beholder"
}
```

---

## 📊 Códigos de Estado HTTP

| Código | Significado | Cuándo ocurre |
|--------|------------|---------------|
| `200` | OK | Solicitud exitosa |
| `400` | Bad Request | Datos inválidos o incompletos |
| `401` | Unauthorized | API Key faltante o inválida |
| `404` | Not Found | Recurso no existe |
| `500` | Server Error | Error interno del servidor |

---

## 🔄 Rate Limiting

Los endpoints respetan los siguientes límites:

```
General API:    10 requests/segundo
Auth/Login:     5 requests/minuto
Search:         20 requests/minuto
Diagnosis:      5 requests/minuto
```

Si excedes el límite, recibirás:
```json
{
  "detail": "Too many requests"
}
```

---

## 💡 Ejemplos con curl

### Obtener tickets
```bash
curl -X GET "http://localhost/api/tickets" \
  -H "x-api-key: tu_api_key"
```

### Crear ticket
```bash
curl -X POST "http://localhost/api/tickets" \
  -H "x-api-key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Internet lento",
    "description": "Velocidad baja",
    "priority": "high",
    "service_id": 5
  }'
```

### Diagnóstico de usuario
```bash
curl -X GET "http://localhost/api/diagnosis/juan_perez" \
  -H "Content-Type: application/json"
```

### Búsqueda
```bash
curl -X GET "http://localhost/api/search?q=juan" \
  -H "Content-Type: application/json"
```

---

## 🎫 Tickets v2.0 (NUEVO - 02/01/2026)

Sistema completo de gestión de tickets con órdenes de trabajo y telemetría en tiempo real.

### GET /api/v1/tickets
Obtener lista de todos los tickets del operador.

**Autenticación:** Requerida (JWT Token)  
**Método:** GET  
**URL:** `/api/v1/tickets?status=open&priority=high&assigned_to_id=uuid&limit=50&offset=0`

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| status | string | Filtro: open, in_progress, closed |
| priority | string | Filtro: low, medium, high, critical |
| assigned_to_id | uuid | Filtro: solo OTs asignadas a técnico |
| limit | int | Paginación (default: 50) |
| offset | int | Paginación (default: 0) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "ticket_code": "CNX-8821",
      "title": "Internet lento",
      "description": "Cliente reporta velocidad baja",
      "status": "in_progress",
      "priority": "high",
      "assigned_to": {
        "id": "uuid",
        "name": "Juan Técnico"
      },
      "creator": {
        "id": "uuid",
        "name": "María Operadora"
      },
      "created_at": "2026-01-02T10:30:00Z",
      "updated_at": "2026-01-02T14:15:00Z",
      "work_order_count": 1,
      "last_timeline_event": {
        "id": "uuid",
        "event_type": "ot_created",
        "content": "Orden de trabajo generada",
        "created_at": "2026-01-02T14:15:00Z"
      }
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### GET /api/v1/tickets/{id}
Obtener detalle completo de un ticket con timeline y órdenes de trabajo.

**Autenticación:** Requerida  
**Método:** GET  
**URL:** `/api/v1/tickets/550e8400-e29b-41d4-a716-446655440000`

**Response (200):**
```json
{
  "ticket": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_code": "CNX-8821",
    "title": "Internet lento",
    "description": "Cliente reporta velocidad baja desde hace 3 días",
    "status": "in_progress",
    "priority": "high",
    "assigned_to": {
      "id": "uuid",
      "name": "Juan Técnico"
    },
    "creator": {
      "id": "uuid",
      "name": "María Operadora"
    },
    "created_at": "2026-01-02T10:30:00Z",
    "updated_at": "2026-01-02T14:15:00Z"
  },
  "timeline": [
    {
      "id": "uuid",
      "event_type": "note",
      "content": "Cliente confirma disponibilidad el viernes",
      "author": {
        "id": "uuid",
        "name": "María Operadora"
      },
      "meta_data": {
        "message": "Cliente confirma disponibilidad el viernes"
      },
      "created_at": "2026-01-02T12:00:00Z"
    },
    {
      "id": "uuid",
      "event_type": "ot_created",
      "content": "Orden de trabajo generada",
      "author": {
        "id": "uuid",
        "name": "María Operadora"
      },
      "meta_data": {
        "work_order_id": "uuid",
        "ot_type": "diagnosis",
        "scheduled_date": "2026-01-04T10:00:00Z",
        "technician": "Juan Técnico"
      },
      "created_at": "2026-01-02T14:15:00Z"
    },
    {
      "id": "uuid",
      "event_type": "telemetry",
      "content": "Alerta: Señal ONU baja (-28 dBm)",
      "author": null,
      "meta_data": {
        "onu_sn": "GPON12AB34CD56",
        "signal_dbm": -28,
        "onu_status": "online",
        "infraestructura": "PON-ZONA-3"
      },
      "created_at": "2026-01-02T13:45:00Z"
    }
  ],
  "work_orders": [
    {
      "id": "uuid",
      "ot_type": "diagnosis",
      "status": "scheduled",
      "scheduled_date": "2026-01-04T10:00:00Z",
      "completed_at": null,
      "total_duration": null,
      "technician": {
        "id": "uuid",
        "name": "Juan Técnico"
      },
      "items": [
        {
          "id": "uuid",
          "product_id": null,
          "serial_number": "GPON12AB34CD56",
          "quantity": 1,
          "consumed_at": null
        }
      ],
      "created_at": "2026-01-02T14:15:00Z"
    }
  ]
}
```

### POST /api/v1/tickets
Crear un nuevo ticket.

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/api/v1/tickets`

**Request Body:**
```json
{
  "title": "Internet lento",
  "description": "Cliente reporta velocidad baja",
  "priority": "high",
  "assigned_to_id": "uuid-opcional"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ticket_code": "CNX-8821",
  "title": "Internet lento",
  "description": "Cliente reporta velocidad baja",
  "status": "open",
  "priority": "high",
  "assigned_to_id": null,
  "creator_id": "current-user-uuid",
  "created_at": "2026-01-02T10:30:00Z",
  "updated_at": "2026-01-02T10:30:00Z"
}
```

### PATCH /api/v1/tickets/{id}
Actualizar estado/prioridad/asignación de un ticket.

**Autenticación:** Requerida  
**Método:** PATCH  
**URL:** `/api/v1/tickets/550e8400-e29b-41d4-a716-446655440000`

**Request Body (todos opcionales):**
```json
{
  "title": "Internet lento - CRÍTICO",
  "status": "in_progress",
  "priority": "critical",
  "assigned_to_id": "uuid-tecnico"
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ticket_code": "CNX-8821",
  "status": "in_progress",
  "priority": "critical",
  "assigned_to_id": "uuid-tecnico",
  "updated_at": "2026-01-02T14:15:00Z"
}
```

### POST /api/v1/tickets/{id}/request-visit
Crear una orden de trabajo (solicitud de visita técnica).

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/api/v1/tickets/550e8400-e29b-41d4-a716-446655440000/request-visit`

**Request Body:**
```json
{
  "ot_type": "diagnosis",
  "scheduled_date": "2026-01-04T10:00:00Z",
  "technician_id": "uuid-opcional"
}
```

**Response (201):**
```json
{
  "id": "work-order-uuid",
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "ot_type": "diagnosis",
  "status": "pending_planning",
  "scheduled_date": "2026-01-04T10:00:00Z",
  "technician_id": null,
  "created_at": "2026-01-02T14:15:00Z"
}
```

**Efectos secundarios:**
- Crea entrada en `ticket_timeline` con `event_type: "ot_created"`
- Guarda snapshot de OT en `meta_data` del timeline event

### POST /api/v1/tickets/{id}/timeline
Agregar nota a la bitácora del ticket.

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/api/v1/tickets/550e8400-e29b-41d4-a716-446655440000/timeline`

**Request Body:**
```json
{
  "content": "Cliente confirma disponibilidad el viernes"
}
```

**Response (201):**
```json
{
  "id": "timeline-event-uuid",
  "event_type": "note",
  "content": "Cliente confirma disponibilidad el viernes",
  "author": {
    "id": "current-user-uuid",
    "name": "María Operadora"
  },
  "created_at": "2026-01-02T12:00:00Z"
}
```

### PATCH /api/v1/work-orders/{id}/status
Actualizar estado de una orden de trabajo.

**Autenticación:** Requerida  
**Método:** PATCH  
**URL:** `/api/v1/work-orders/work-order-uuid/status`

**Request Body:**
```json
{
  "status": "in_progress",
  "technician_id": "uuid-opcional"
}
```

**Response (200):**
```json
{
  "id": "work-order-uuid",
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "in_progress",
  "technician_id": "uuid-tecnico",
  "updated_at": "2026-01-02T15:30:00Z"
}
```

**Estados válidos:**
- `pending_planning` → `scheduled` (programada)
- `scheduled` → `in_progress` (técnico llegó)
- `in_progress` → `completed` (trabajo terminado)
- Cualquiera → `cancelled` (cancelada)

---

## 🔧 ENDPOINTS v2 - Cierre de Órdenes de Trabajo (NUEVO - 07/01/2026)

### PATCH /api/v2/work-orders/{id}
Completar una orden de trabajo con categorización de resolución y evidencia fotográfica.

**Autenticación:** Requerida (JWT)  
**Método:** PATCH  
**URL:** `/api/v2/work-orders/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Request Body:**
```json
{
  "resolution_type": "fixed",
  "resolution_notes": "Se reemplazó el módulo GPON que presentaba mala señal. Se verificó sincronización correcta.",
  "resolution_category": "equipment",
  "photo_urls": [
    "/media/tickets/20/2026-01-07_15-30-45-compressed.jpg",
    "/media/tickets/20/2026-01-07_15-32-10-compressed.jpg"
  ]
}
```

**Validaciones:**
- `resolution_notes` (string, 10-1000 caracteres, obligatorio)
- `resolution_category` (enum: `infrastructure`, `equipment`, `configuration`, `other`)
- `photo_urls` (array de strings, máximo 10 fotos)
- Cada foto debe ser un attachment previamente subido

**Response (200):**
```json
{
  "id": "work-order-uuid",
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "ot_type": "repair",
  "status": "completed",
  "technician_id": "tech-uuid",
  "scheduled_at": "2026-01-07T10:00:00Z",
  "started_at": "2026-01-07T15:00:00Z",
  "completed_at": "2026-01-07T15:45:00Z",
  "resolution_type": "fixed",
  "resolution_notes": "Se reemplazó el módulo GPON que presentaba mala señal. Se verificó sincronización correcta.",
  "resolution_category": "equipment",
  "photo_urls": [
    "/media/tickets/20/2026-01-07_15-30-45-compressed.jpg",
    "/media/tickets/20/2026-01-07_15-32-10-compressed.jpg"
  ],
  "custom_data": null,
  "notes": null,
  "created_at": "2026-01-02T14:15:00Z",
  "updated_at": "2026-01-07T15:45:00Z"
}
```

**Efectos secundarios:**
- Marca la OT como `completed` y establece `completed_at` con timestamp actual
- Crea entrada en `ticket_timeline` con `event_type: "ot_completed"`
- meta_data del timeline incluye: `photo_count`, `resolution_category`, `resolution_type`
- Actualiza el ticket asociado con información de cierre en la bitácora

---

### GET /api/v2/work-orders/{id}
Obtener detalles completos de una orden de trabajo (incluye fotos y categorización).

**Autenticación:** Requerida (JWT)  
**Método:** GET  
**URL:** `/api/v2/work-orders/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Response (200):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "ticket_code": "CNX-8821",
  "ot_type": "repair",
  "status": "completed",
  "technician_id": "tech-uuid-123",
  "technician_name": "Juan Pérez",
  "scheduled_at": "2026-01-07T10:00:00Z",
  "started_at": "2026-01-07T15:00:00Z",
  "completed_at": "2026-01-07T15:45:00Z",
  "resolution_type": "fixed",
  "resolution_notes": "Se reemplazó el módulo GPON que presentaba mala señal. Se verificó sincronización correcta.",
  "resolution_category": "equipment",
  "photo_urls": [
    "/media/tickets/20/2026-01-07_15-30-45-compressed.jpg",
    "/media/tickets/20/2026-01-07_15-32-10-compressed.jpg"
  ],
  "custom_data": {
    "equipment_swapped": true,
    "old_serial": "GPON12AB34CD56",
    "new_serial": "GPON99XY87ZZ11"
  },
  "notes": "Cliente agradecido con el trabajo",
  "created_at": "2026-01-02T14:15:00Z",
  "updated_at": "2026-01-07T15:45:00Z"
}
```

**Campos nuevos (v2):**
- `started_at`: Timestamp cuando el técnico inició la ejecución
- `completed_at`: Timestamp de finalización (se establece al hacer PATCH con cierre)
- `resolution_type`: Tipo de resolución (`fixed`, `pending`, `transferred`, etc.)
- `resolution_notes`: Descripción narrativa de qué se hizo (mín 10 caracteres)
- `resolution_category`: Categorización de causa raíz (`infrastructure`, `equipment`, `configuration`, `other`)
- `photo_urls`: Array de URLs a fotos de evidencia (máx 10 imágenes)

---

### POST /api/v1/work-orders/{id}/items
Agregar material consumido en una orden de trabajo.

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/api/v1/work-orders/work-order-uuid/items`

**Request Body:**
```json
{
  "serial_number": "GPON12AB34CD56",
  "quantity": 1,
  "product_id": "uuid-opcional"
}
```

**Response (201):**
```json
{
  "id": "item-uuid",
  "work_order_id": "work-order-uuid",
  "serial_number": "GPON12AB34CD56",
  "quantity": 1,
  "product_id": null,
  "consumed_at": "2026-01-02T15:45:00Z"
}
```

### POST /api/v1/tickets/{id}/close
Cerrar un ticket (marcar como resuelto).

**Autenticación:** Requerida  
**Método:** POST  
**URL:** `/api/v1/tickets/550e8400-e29b-41d4-a716-446655440000/close`

**Request Body:**
```json
{
  "resolution_summary": "Se reemplazó ONU defectuosa. Cliente reporta velocidad normal."
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ticket_code": "CNX-8821",
  "status": "closed",
  "updated_at": "2026-01-02T16:00:00Z"
}
```

**Efectos secundarios:**
- Marca todas las OT asociadas como `completed` (si no lo están)
- Crea entrada en timeline con `event_type: "closed"` y resolution_summary en meta_data
- Generable automático de reporte de servicio

---

## 📚 Próximos Pasos

- Revisar [docs/SEGURIDAD.md](../docs/SEGURIDAD.md) para autenticación detallada
- Consultar [docs/INTEGRACIONES.md](../docs/INTEGRACIONES.md) para entender origen de datos
- Ver [docs/BASE_DATOS.md](../docs/BASE_DATOS.md) para esquema de BD

---

**Última actualización:** 02 de enero de 2026  
**Versión de API:** 1.0.0
