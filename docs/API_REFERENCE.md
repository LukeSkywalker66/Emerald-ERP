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

## 📚 Próximos Pasos

- Revisar [docs/SEGURIDAD.md](../docs/SEGURIDAD.md) para autenticación detallada
- Consultar [docs/INTEGRACIONES.md](../docs/INTEGRACIONES.md) para entender origen de datos
- Ver [docs/BASE_DATOS.md](../docs/BASE_DATOS.md) para esquema de BD

---

**Última actualización:** 30 de diciembre de 2025  
**Versión de API:** 1.0.0
