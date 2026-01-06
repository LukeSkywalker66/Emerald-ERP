# 🔐 Sistema de API Keys - Guía Completa

Emerald ERP ahora cuenta con un sistema profesional y seguro de API Keys con validación, rotación automática, y auditoría completa.

---

## 📋 Índice

1. [Conceptos Generales](#conceptos-generales)
2. [Crear una API Key](#crear-una-api-key)
3. [Usar una API Key](#usar-una-api-key)
4. [Rotación Automática](#rotación-automática)
5. [Auditoría y Monitoreo](#auditoría-y-monitoreo)
6. [Endpoints Admin](#endpoints-admin)
7. [Configuración Celery](#configuración-celery)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Conceptos Generales

### ¿Qué es una API Key?

Una **API Key** es un token de autenticación único que identifica a un cliente/bot que accede a la API de Emerald.

**Diferencia con usuario/contraseña:**
- ✅ Más segura: No expone credenciales reales
- ✅ Rotable: Se cambia sin afectar el login del usuario
- ✅ Granular: Se pueden asignar permisos específicos
- ✅ Auditable: Se registra cada uso en la BD

### Características del Sistema

| Característica | Detalle |
|---|---|
| **Formato** | `iso_<32 caracteres random>` |
| **Hash** | Almacenada con bcrypt (nunca en texto plano) |
| **Expiración** | Configurable (default 90 días) |
| **Rotación** | Automática 7 días antes de expirar |
| **Auditoría** | Cada uso registrado con IP y endpoint |
| **Scopes** | `["read", "write"]` para granularidad |

---

## 🔑 Crear una API Key

### Opción 1: Por API (Recomendado para Automatización)

```bash
# Crear nueva API Key
curl -X POST "http://localhost/admin/api-keys" \
  -H "x-api-key: ${EXISTING_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISPCube Sync Bot",
    "scopes": ["read", "write"],
    "expires_in_days": 90
  }'
```

**Response:**

```json
{
  "id": 1,
  "name": "ISPCube Sync Bot",
  "key": "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
  "prefix": "iso_aBcDeFg",
  "expires_at": "2026-03-30T10:30:00",
  "scopes": ["read", "write"],
  "warning": "⚠️ Copia esta key ahora. No se mostrará de nuevo."
}
```

**⚠️ IMPORTANTE:** La key se devuelve **UNA SOLA VEZ**. Copiarla y guardarla en `.env` inmediatamente.

### Opción 2: Interfaz Web (Futuro)

Cuando esté implementado el dashboard de admin, habrá un formulario web para crear keys.

---

## 🚀 Usar una API Key

### Estructura del Header

Incluir en cada request a endpoints protegidos:

```http
GET /api/clientes HTTP/1.1
Host: emerald.2finternet.ar
x-api-key: iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789
Content-Type: application/json
```

### Ejemplos

#### cURL

```bash
# Obtener clientes
curl -X GET "http://localhost/api/clientes" \
  -H "x-api-key: iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
```

#### Python (requests)

```python
import requests

API_KEY = "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
headers = {"x-api-key": API_KEY}

response = requests.get(
    "http://localhost/api/clientes",
    headers=headers
)

print(response.json())
```

#### Node.js (fetch)

```javascript
const API_KEY = "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";

fetch("http://localhost/api/clientes", {
  method: "GET",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

#### Bash Script

```bash
#!/bin/bash
API_KEY="iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
ENDPOINT="http://localhost/api/clientes"

curl -s -X GET "$ENDPOINT" \
  -H "x-api-key: $API_KEY" | jq .
```

---

## 🔄 Rotación Automática

### ¿Cómo Funciona?

1. **Diariamente a las 2 AM** (zona Argentina): 
   - Celery busca keys que expiren en 7 días
   - Genera nuevas keys automáticamente
   - Marca las viejas como inactivas
   - **Envía notificación al admin** (próximamente)

2. **El viejo prefijo deja de funcionar**
   - La key antigua se desactiva
   - Los scripts reciben error 401

3. **Necesita actualización manual**
   - Admin recibe email con la nueva key
   - Debe actualizar `.env` o variables de ambiente
   - Redeploy de la aplicación

### Timeline de Expiración

```
Día 1-83:  ✅ Key activa, sin alertas
Día 84:    ⚠️  Alerta: "Expira en 7 días"
Día 84-90: 🔄  Rotación automática ejecutada
Día 84-90: 📧 Email al admin con nueva key
Día 91:    ❌  Key antigua se desactiva completamente
Día 91+:   🚫  Requests con key vieja devuelven 401
```

### Rotación Manual

Si necesitas rotar una key antes de que expire:

```bash
curl -X POST "http://localhost/admin/api-keys/1/rotate" \
  -H "x-api-key: ${EXISTING_API_KEY}"
```

---

## 📊 Auditoría y Monitoreo

### Log de Uso

Cada request a la API genera un registro de auditoría:

```json
{
  "timestamp": "2025-12-30T10:15:32.123456",
  "api_key_id": 1,
  "action": "used",
  "ip_address": "192.168.1.100",
  "endpoint": "/api/clientes",
  "status_code": 200
}
```

### Acciones Registradas

| Acción | Descripción |
|---|---|
| `created` | API Key fue creada |
| `used` | Se usó exitosamente |
| `invalid_key` | Se intentó usar una key inválida |
| `expired` | Se detectó que expiró |
| `rotated` | Fue rotada automáticamente |
| `revoked` | Fue revocada manualmente |

### Alertas Automáticas

El sistema ejecuta automáticamente:

- **Cada día a las 2 AM**: Rotar keys próximas a expirar
- **Cada día a las 3:30 AM**: Limpiar keys ya expiradas
- **Cada 3 días a la 1 AM**: Alerta de keys por expirar (30 días)
- **Domingos a las 4 AM**: Reporte de auditoría semanal

---

## 🔧 Endpoints Admin

### Crear API Key

```
POST /admin/api-keys
Autenticación: API Key o JWT
```

**Request:**
```json
{
  "name": "Mi Integración",
  "scopes": ["read"],
  "expires_in_days": 90
}
```

**Response:** `APIKeyCreateResponse` (incluye la key sin hash)

---

### Listar API Keys

```
GET /admin/api-keys
Autenticación: API Key o JWT
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "ISPCube Sync",
    "prefix": "iso_abcdef",
    "active": true,
    "created_at": "2025-12-30T10:00:00",
    "expires_at": "2026-03-30T10:00:00",
    "last_used": "2025-12-30T10:15:00",
    "scopes": ["read", "write"],
    "rotation_count": 0
  }
]
```

---

### Rotar API Key

```
POST /admin/api-keys/{key_id}/rotate
Autenticación: API Key o JWT
```

**Response:** `APIKeyCreateResponse` (nueva key)

---

### Revocar API Key

```
DELETE /admin/api-keys/{key_id}
Autenticación: API Key o JWT
```

**Response:**
```json
{
  "message": "API Key revoked successfully"
}
```

---

### Ver Log de Auditoría

```
GET /admin/api-keys/{key_id}/audit?limit=50
Autenticación: API Key o JWT
```

**Response:**
```json
{
  "audit_log": [
    {
      "timestamp": "2025-12-30T10:15:32",
      "api_key_id": 1,
      "action": "used",
      "ip_address": "192.168.1.100",
      "endpoint": "/api/clientes",
      "status_code": 200,
      "details": null
    }
  ]
}
```

---

### Ver Log de Auditoría (Todas las Keys)

```
GET /admin/api-keys/audit/all?limit=100
Autenticación: API Key o JWT
```

---

## ⚙️ Configuración Celery

Las tareas de rotación están en `src/jobs/api_key_rotation.py` y se programan en `src/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
    # ... otras tareas ...
    
    "api-keys-rotate-expiring": {
        "task": "api_keys.rotate_expiring",
        "schedule": crontab(hour=2, minute=0),  # 2 AM diariamente
    },
    
    "api-keys-cleanup-expired": {
        "task": "api_keys.cleanup_expired",
        "schedule": crontab(hour=3, minute=30),  # 3:30 AM diariamente
    },
    
    "api-keys-alert-expiring": {
        "task": "api_keys.alert_expiring",
        "schedule": crontab(hour=1, minute=0, day_of_week='0,3,6'),  # Cada 3 días
    },
}
```

### Verificar Estado de Tareas

```bash
# Ver tareas pendientes
docker compose exec celery celery -A src.celery_app inspect active

# Ver tareas completadas
docker compose exec celery celery -A src.celery_app inspect stats

# Ver programación
docker compose exec celery celery -A src.celery_app inspect scheduled
```

---

## 🐛 Troubleshooting

### Error: "API Key inválida o expirada"

**Causas posibles:**

1. **Key no existe**: Se deletó de la BD o tiene typo
2. **Key expirada**: Fue rotada automáticamente
3. **Key revocada**: Un admin la desactivó manualmente

**Solución:**
```bash
# Ver las keys activas
curl -X GET "http://localhost/admin/api-keys" \
  -H "x-api-key: $ADMIN_KEY"
```

---

### Error: "Se requiere API Key o JWT Token"

La solicitud llegó a un endpoint protegido sin autenticación.

**Solucionar:**
```bash
# Agregar header correcto
curl -X GET "http://localhost/api/clientes" \
  -H "x-api-key: iso_YOUR_KEY_HERE"
```

---

### La Rotación Automática No Ocurre

**Verificar:**

1. **¿Celery Beat está corriendo?**
```bash
docker compose logs -f celery-beat
```

2. **¿Las tareas están registradas?**
```bash
docker compose exec celery celery -A src.celery_app inspect scheduled
```

3. **¿Redis está disponible?**
```bash
docker compose exec redis redis-cli ping
# Debe responder: PONG
```

4. **¿Hay keys por expirar (7 días)?**
```sql
SELECT * FROM api_keys 
WHERE expires_at < NOW() + INTERVAL '7 days'
  AND expires_at > NOW()
  AND active = 1;
```

---

### No Recibo Email de Rotación

Actualmente la función de email está marcada con `# TODO:`. Para implementarla:

1. Agregar configuración SMTP en `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=no-reply@emerald.com
```

2. Implementar `send_email_notification()` en `api_key_service.py`

3. Descomentar las llamadas en `api_key_rotation.py`

---

## 📚 Archivos Relacionados

- **Models**: [backend/src/models.py](../backend/src/models.py#L120-L155)
- **Service**: [backend/src/services/api_key_service.py](../backend/src/services/api_key_service.py)
- **Jobs**: [backend/src/jobs/api_key_rotation.py](../backend/src/jobs/api_key_rotation.py)
- **Endpoints**: [backend/src/main.py](../backend/src/main.py#L275-L415)
- **Config**: [backend/src/celery_app.py](../backend/src/celery_app.py)
- **Migrations**: [backend/alembic/versions/9b4f2c8e1d2a_agregar_tablas_de_api_keys.py](../backend/alembic/versions/9b4f2c8e1d2a_agregar_tablas_de_api_keys.py)

---

## 🔒 Mejores Prácticas

1. **Nunca commitear keys a Git**
   - Usar variables de ambiente
   - Usar `.env.local` (gitignored)

2. **Rotar keys regularmente**
   - Default: 90 días
   - En producción: 60 días es mejor
   - Aumentar en desarrollo: 180-365 días

3. **Usar scopes limitados**
   - ISPCube Sync: `["read", "write"]`
   - Dashboard: `["read"]`
   - Monitoreo: `["read"]`

4. **Auditar regularmente**
   - Revisar `/admin/api-keys/audit/all` cada semana
   - Alertar si IP sospechosa accede

5. **Revocar inmediatamente**
   - Si se leak una key
   - Si un empleado se va
   - Si detect uso anómalo

---

## 📞 Soporte

Si tienes problemas con el sistema de API Keys:

1. Revisa los logs: `docker compose logs backend`
2. Verifica la BD: `SELECT * FROM api_key_audit ORDER BY timestamp DESC LIMIT 20;`
3. Consulta la auditoría: `GET /admin/api-keys/audit/all?limit=100`
