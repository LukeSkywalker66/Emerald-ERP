# 📑 Índice de Archivos - Sistema de API Keys

Guía rápida para encontrar y entender cada parte del sistema.

---

## 📂 Estructura de Archivos

### 🔧 Código Backend

```
backend/
├── src/
│   ├── models.py ⭐
│   │   └─ + APIKey (clase)
│   │   └─ + APIKeyAudit (clase)
│   │
│   ├── services/
│   │   └─ api_key_service.py ⭐ NUEVO
│   │       └─ APIKeyService (10 métodos)
│   │
│   ├── jobs/
│   │   └─ api_key_rotation.py ⭐ NUEVO
│   │       └─ 4 tareas Celery
│   │
│   ├── main.py ⭐
│   │   └─ + Middleware mejorado
│   │   └─ + 6 endpoints /admin/api-keys/*
│   │
│   ├── celery_app.py ⭐
│   │   └─ + Beat schedule para tasks
│   │
│   └── config.py
│       └─ Variables de entorno (sin cambios)
│
├── alembic/
│   └── versions/
│       └─ 9b4f2c8e1d2a_*.py ⭐ NUEVO
│           └─ Migración para tablas
│
├── requirements.txt ⭐
│   └─ + python-jose[cryptography]
│
└── .env.example ⭐
    └─ + JWT variables
```

---

## 📖 Documentación

### Guías de Usuario

| Archivo | Para Quién | Contenido |
|---------|-----------|----------|
| [docs/API_KEYS.md](../docs/API_KEYS.md) | Desarrolladores | Guía completa, ejemplos en 4 lenguajes |
| [IMPLEMENTACION_API_KEYS.md](../IMPLEMENTACION_API_KEYS.md) | Tech Lead | Resumen técnico, arquitectura |
| [API_KEYS_SUMMARY.md](../API_KEYS_SUMMARY.md) | Todos | Guía visual, roadmap |
| [CHECKLIST_CAMBIOS.md](../CHECKLIST_CAMBIOS.md) | Revisor | Qué cambió exactamente |

### Scripts y Testing

| Archivo | Propósito | Uso |
|---------|----------|-----|
| [test_api_keys.sh](../test_api_keys.sh) | Validación | `bash test_api_keys.sh` |

---

## 🔍 Navegación Rápida

### Para Crear una API Key

1. Endpoint: [main.py#L176](../backend/src/main.py) - `POST /admin/api-keys`
2. Lógica: [api_key_service.py#L65](../backend/src/services/api_key_service.py) - `create_api_key()`
3. Modelo: [models.py#L127](../backend/src/models.py) - `class APIKey`
4. Documentación: [API_KEYS.md#crear](../docs/API_KEYS.md)

### Para Validar una API Key (en cada request)

1. Middleware: [main.py#L65](../backend/src/main.py) - `security_middleware()`
2. Validación: [api_key_service.py#L132](../backend/src/services/api_key_service.py) - `validate_api_key()`
3. Hash: [api_key_service.py#L41](../backend/src/services/api_key_service.py) - `verify_key()`

### Para Rotar una API Key

1. Endpoint: [main.py#L209](../backend/src/main.py) - `POST /admin/api-keys/{id}/rotate`
2. Lógica: [api_key_service.py#L218](../backend/src/services/api_key_service.py) - `rotate_api_key()`
3. Automático: [api_key_rotation.py#L32](../backend/src/jobs/api_key_rotation.py) - `rotate_expiring_api_keys()`

### Para Ver Auditoría

1. Endpoint: [main.py#L237](../backend/src/main.py) - `GET /admin/api-keys/{id}/audit`
2. Endpoint: [main.py#L250](../backend/src/main.py) - `GET /admin/api-keys/audit/all`
3. Lógica: [api_key_service.py#L309](../backend/src/services/api_key_service.py) - `get_audit_log()`

---

## 📊 Tablas de Base de Datos

### api_keys

Ver: [models.py#L127](../backend/src/models.py) - `class APIKey`

```
Columna             Tipo        Descripción
─────────────────────────────────────────────────────────────
id                  INT PK      ID de la key
name                STRING      Nombre descriptivo
key_hash            STRING      Hash bcrypt (NUNCA texto plano)
key_prefix          STRING(10)  Primeros 10 chars para búsqueda
created_at          DATETIME    Cuándo se creó
last_used           DATETIME    Último uso
expires_at          DATETIME    Cuándo expira
active              INT          1=activa, 0=inactiva
scopes              JSON        ["read", "write", ...]
created_by          STRING      Quién la creó
rotation_count      INT         Cuántas veces rotó
last_rotated_at     DATETIME    Última rotación
```

### api_key_audit

Ver: [models.py#L154](../backend/src/models.py) - `class APIKeyAudit`

```
Columna             Tipo        Descripción
─────────────────────────────────────────────────────────────
id                  INT PK      ID del registro
api_key_id          INT         FK a api_keys (soft)
action              STRING      "created", "used", "rotated", etc
timestamp           DATETIME    Cuándo ocurrió
ip_address          STRING      IP del cliente
endpoint            STRING      /api/clientes, /admin/api-keys, etc
status_code         INT         200, 401, 403, etc
details             JSON        Información adicional
```

---

## 🔐 Métodos del Servicio

### APIKeyService (10 métodos)

Ver: [api_key_service.py](../backend/src/services/api_key_service.py)

| Método | Parámetros | Retorna | Uso |
|--------|-----------|---------|-----|
| `generate_key()` | - | `str` | Generar nueva key |
| `hash_key(key)` | `str` | `str` | Hash bcrypt |
| `verify_key(plain, hash)` | `str, str` | `bool` | Verificar coincidencia |
| `create_api_key(db, name, scopes, days, by)` | Múltiples | `dict` | Crear nueva |
| `validate_api_key(db, key, ip)` | `Session, str, str` | `dict\|None` | Validar en request |
| `rotate_api_key(db, id, days)` | `Session, int, int` | `dict` | Rotar manualmente |
| `cleanup_expired_keys(db)` | `Session` | `int` | Limpiar expiradas |
| `alert_expiring_keys(db, days)` | `Session, int` | `list` | Obtener próximas |
| `revoke_api_key(db, id)` | `Session, int` | `bool` | Desactivar |
| `get_audit_log(db, id, limit)` | `Session, int\|None, int` | `list` | Ver auditoría |

---

## ⚙️ Tareas Celery

Ver: [api_key_rotation.py](../backend/src/jobs/api_key_rotation.py)

| Tarea | Horario | Descripción |
|-------|---------|------------|
| `api_keys.rotate_expiring` | 2:00 AM diario | Rota keys próximas a expirar (7 días) |
| `api_keys.cleanup_expired` | 3:30 AM diario | Marca como inactivas las expiradas |
| `api_keys.alert_expiring` | 1:00 AM c/3 días | Alerta sobre keys por vencer (30 días) |
| `api_keys.generate_audit_report` | 4:00 AM domingo | Reporte semanal de auditoría |

**Programación:** Ver [celery_app.py#L20](../backend/src/celery_app.py)

---

## 🔌 Endpoints Admin

Ver: [main.py#L176-L300](../backend/src/main.py)

### POST /admin/api-keys
Crear nueva API Key

**Autenticación:** API Key o JWT  
**Request:**
```json
{
  "name": "Mi Key",
  "scopes": ["read"],
  "expires_in_days": 90
}
```
**Response:** `APIKeyCreateResponse` (incluye key sin hash)

---

### GET /admin/api-keys
Listar todas las API Keys

**Autenticación:** API Key o JWT  
**Response:** `List[APIKeyResponse]`

---

### POST /admin/api-keys/{key_id}/rotate
Rotar API Key manualmente

**Autenticación:** API Key o JWT  
**Response:** `APIKeyCreateResponse` (nueva key)

---

### DELETE /admin/api-keys/{key_id}
Revocar API Key

**Autenticación:** API Key o JWT  
**Response:** `{"message": "API Key revoked successfully"}`

---

### GET /admin/api-keys/{key_id}/audit
Ver auditoría de key específica

**Autenticación:** API Key o JWT  
**Params:** `limit=50`  
**Response:** `{"audit_log": [...]}`

---

### GET /admin/api-keys/audit/all
Ver auditoría de todas las keys

**Autenticación:** API Key o JWT  
**Params:** `limit=100`  
**Response:** `{"total_records": N, "audit_log": [...]}`

---

## 🧪 Testing

### Script de Validación: [test_api_keys.sh](../test_api_keys.sh)

**Ejecutar:**
```bash
bash test_api_keys.sh
```

**Pruebas:**
1. Health check (sin auth)
2. Acceso sin key → 401
3. Crear nueva key
4. Listar keys
5. Usar key válida → 200
6. Usar key inválida → 401
7. Ver auditoría
8. Rotar key

---

## 📝 Ejemplos de Uso

### Python

```python
import requests

API_KEY = "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
headers = {"x-api-key": API_KEY}

# GET
response = requests.get(
    "http://localhost/api/clientes",
    headers=headers
)

# POST
response = requests.post(
    "http://admin/api-keys",
    headers={"x-api-key": ADMIN_KEY},
    json={"name": "Nueva", "scopes": ["read"]}
)
```

**Ver:** [API_KEYS.md#python](../docs/API_KEYS.md)

### Node.js

```javascript
const API_KEY = "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";

fetch("http://localhost/api/clientes", {
  headers: { "x-api-key": API_KEY }
})
  .then(r => r.json())
  .then(data => console.log(data));
```

**Ver:** [API_KEYS.md#nodejs](../docs/API_KEYS.md)

### cURL

```bash
export API_KEY="iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"

curl -H "x-api-key: $API_KEY" \
  http://localhost/api/clientes
```

**Ver:** [API_KEYS.md#curl](../docs/API_KEYS.md)

---

## 🚀 Deployment

### Pre-Requisitos
- PostgreSQL 12+
- Redis 6+
- Python 3.9+
- Celery + Celery Beat

### Pasos

1. **Instalar dependencia:**
   ```bash
   pip install python-jose[cryptography]
   ```

2. **Ejecutar migración:**
   ```bash
   alembic upgrade head
   ```

3. **Verificar tablas:**
   ```bash
   psql -U admin -d emerald -c "\d api_keys; \d api_key_audit;"
   ```

4. **Reiniciar servicios:**
   ```bash
   docker-compose restart backend celery celery-beat
   ```

5. **Validar:**
   ```bash
   bash test_api_keys.sh
   ```

**Ver:** [IMPLEMENTACION_API_KEYS.md#deployment](../IMPLEMENTACION_API_KEYS.md)

---

## 🔄 Flujo Completo

### 1. Crear Key
```
Admin POST /admin/api-keys
  → APIKeyService.create_api_key()
    → Generar key con secrets.token_urlsafe()
    → Hash con bcrypt
    → Guardar en BD
    → Registrar en auditoría
  → Response (con key sin hash, una sola vez)
```

### 2. Usar Key
```
Client GET /api/clientes + Header: x-api-key
  → Middleware (security_middleware)
    → APIKeyService.validate_api_key()
      → Buscar por prefix en BD
      → Verificar hash
      → Chequear expiración
      → Registrar en auditoría
    → Si OK: Permitir request
    → Si NO: 401 Unauthorized
```

### 3. Rotar Key (Automático)
```
Diariamente 2:00 AM:
  → Celery (rotate_expiring_api_keys)
    → APIKeyService.rotate_api_key()
      → Crear nueva key
      → Marcar vieja como inactiva
      → Registrar en auditoría
    → Enviar email (TODO)
```

---

## 📊 Métricas y Monitoreo

### Verificar Tareas Celery
```bash
docker-compose exec celery celery -A src.celery_app inspect active
docker-compose exec celery celery -A src.celery_app inspect scheduled
```

### Ver Logs
```bash
docker-compose logs -f backend
docker-compose logs -f celery-beat
docker-compose logs -f celery
```

### Consultar BD
```bash
# Keys activas
SELECT * FROM api_keys WHERE active = 1;

# Keys próximas a expirar
SELECT * FROM api_keys 
WHERE expires_at < NOW() + INTERVAL '7 days'
  AND active = 1;

# Auditoría de hoy
SELECT * FROM api_key_audit 
WHERE timestamp > NOW() - INTERVAL '1 day'
ORDER BY timestamp DESC;

# Fallos de validación
SELECT COUNT(*) FROM api_key_audit
WHERE action = 'invalid_key'
  AND timestamp > NOW() - INTERVAL '1 hour';
```

---

## 🆘 Troubleshooting

### Problema: "API Key inválida"

**Verificar:**
1. ¿Key existe en BD?
   ```sql
   SELECT * FROM api_keys WHERE key_prefix = 'iso_abc...';
   ```
2. ¿Está activa?
   ```sql
   SELECT * FROM api_keys WHERE key_prefix = 'iso_abc...' AND active = 1;
   ```
3. ¿Está expirada?
   ```sql
   SELECT * FROM api_keys WHERE key_prefix = 'iso_abc...' AND expires_at > NOW();
   ```

**Solución:** [docs/API_KEYS.md#troubleshooting](../docs/API_KEYS.md)

---

## 📚 Referencias

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
- [Celery Docs](https://docs.celeryproject.org/)
- [Passlib Docs](https://passlib.readthedocs.io/)
- [python-jose Docs](https://github.com/mpdavis/python-jose)

---

## ✅ Checklist de Implementación

- [x] Modelos en BD (APIKey, APIKeyAudit)
- [x] Servicio (APIKeyService)
- [x] Endpoints admin (6)
- [x] Tareas Celery (4)
- [x] Middleware mejorado
- [x] Migración Alembic
- [x] Documentación (4 guías)
- [x] Script de validación
- [ ] Emails de rotación (Phase 2)
- [ ] Rate limiting (Phase 2)
- [ ] Dashboard web (Phase 2)

---

*Documentación completa del sistema de API Keys* ✨
