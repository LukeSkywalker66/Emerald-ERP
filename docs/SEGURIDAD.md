# 🔐 Seguridad y Autenticación

## Modelo de Acceso

Emerald ERP utiliza un modelo de seguridad por capas:

```
┌─────────────────────────────────────────────┐
│         Cliente (Navegador)                 │
└────────────────┬──────────────────────────┘
                 │
        ┌────────▼─────────┐
        │ Nginx            │
        │ - Rate limiting  │
        │ - HTTPS/TLS      │
        │ - CORS           │
        └────────┬─────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
┌────▼────┐ ┌────▼────┐ ┌────▼────┐
│ Frontend │ │ API     │ │Beholder │
│          │ │ /api    │ │ /api    │
└──────────┘ └────┬────┘ └─────────┘
                  │
        ┌─────────▼─────────┐
        │ FastAPI           │
        │ - API Key Check   │
        │ - Whitelist       │
        │ - CORS Middleware │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │ PostgreSQL        │
        │ (Datos sensibles) │
        └───────────────────┘
```

---

## 1. Autenticación de API

### Sistema de API Keys (NUEVO - 30/12/2025)

Emerald ERP ahora usa un sistema profesional de API Keys con:
- ✅ Hash bcrypt (nunca en texto plano)
- ✅ Rotación automática cada 7 días
- ✅ Auditoría completa de accesos
- ✅ Gestión dinámica en BD

**Ver documentación completa:** [docs/API_KEYS.md](API_KEYS.md)

### Endpoints Públicos (Sin autenticación)

```python
WHITELIST = [
    "/docs",                    # Swagger UI
    "/redoc",                   # ReDoc
    "/openapi.json",           # OpenAPI schema
    "/tickets",                # Endpoint demo
    "/services_options",       # Endpoint demo
    "/search",                 # Búsqueda pública
    "/diagnosis",              # Diagnóstico público
    "/live",                   # Status vivo
    "/health",                 # Health check
    "/"                        # Root
]

### Permisos por rol (Tickets)

- `tickets:read` → puede leer tickets y ver timeline.
- `tickets:write` → puede crear, comentar y cambiar estado de tickets.

Si el usuario es `is_superuser=True` se omiten los chequeos. Los permisos se leen desde `role.permissions` (lista de strings o dict con clave `permissions`).

#### Roles por defecto

- `admin`: `[*]` (todos los permisos).
- `tecnico`: `tickets:read`, `tickets:write`, `services:read`, `clients:read`, `diagnosis:read`.
- `viewer`: `tickets:read`, `services:read`, `clients:read`.

Para reprovisionar los roles por defecto:
```bash
docker compose exec -T backend python -m scripts.create_superuser
```
```

### Endpoints Protegidos (Requieren autenticación)

#### Opción 1: API Key (para bots/scripts)

```bash
curl -X GET "http://localhost/api/clientes" \
  -H "x-api-key: iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"
```

**Crear una API Key:**
```bash
curl -X POST "http://localhost/admin/api-keys" \
  -H "x-api-key: ${EXISTING_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISPCube Sync",
    "scopes": ["read", "write"],
    "expires_in_days": 90
  }'
```

**Response (solo una vez):**
```json
{
  "id": 1,
  "name": "ISPCube Sync",
  "key": "iso_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
  "prefix": "iso_aBcDeFg",
  "expires_at": "2026-03-30T10:30:00",
  "scopes": ["read", "write"],
  "warning": "⚠️ Copia esta key ahora. No se mostrará de nuevo."
}
```

#### Opción 2: JWT Token (para futuro frontend)

```bash
curl -X POST "http://localhost/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'

# Response: {"access_token": "eyJhbG...", "token_type": "bearer"}

# Usar:
curl -X GET "http://localhost/api/clientes" \
  -H "Authorization: Bearer eyJhbG..."
```

### Configuración en .env

```bash
# API Key legacy (compatible con sistema anterior)
API_KEY=tu_api_key_super_secreta_aqui_12345

# JWT (para futuro frontend)
SECRET_KEY=tu_secret_key_para_jwt_aqui_cambiar
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30
```

### Endpoints Admin de Gestión

| Método | Endpoint | Descripción |
|--------|----------|------------|
| POST | `/admin/api-keys` | Crear nueva key |
| GET | `/admin/api-keys` | Listar todas |
| POST | `/admin/api-keys/{id}/rotate` | Rotar manualmente |
| DELETE | `/admin/api-keys/{id}` | Revocar |
| GET | `/admin/api-keys/{id}/audit` | Ver auditoría de key |
| GET | `/admin/api-keys/audit/all` | Ver auditoría de todas |

**Ver:** [docs/API_KEYS.md#endpoints-admin](API_KEYS.md#endpoints-admin)

### Rotación Automática (Celery Beat)

Las API Keys se rotan automáticamente en estas horas (zona Argentina):

| Hora | Tarea | Descripción |
|------|-------|------------|
| 2:00 AM | rotate_expiring | Rota keys próximas a expirar (7 días) |
| 3:30 AM | cleanup_expired | Limpia keys expiradas |
| 1:00 AM | alert_expiring | Alerta sobre vencimientos (cada 3 días) |
| 4:00 AM | generate_audit_report | Reporte semanal (domingo) |

**Implementación:** [backend/src/jobs/api_key_rotation.py](../backend/src/jobs/api_key_rotation.py)

---

## 2. CORS (Cross-Origin Resource Sharing)

### Configuración Actual

```python
# En main.py:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # ⚠️ Permitir todos los orígenes
    allow_credentials=True,
    allow_methods=["*"],           # GET, POST, PUT, DELETE, OPTIONS
    allow_headers=["*"],           # Todos los headers
)
```

### ⚠️ Para Producción

```python
# Usar lista explícita:
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://emerald.2finternet.ar",
        "https://beholder.2finternet.ar",
    ],
    allow_credentials=False,       # No enviar cookies
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "x-api-key"],
)
```

---

## 3. HTTPS/TLS (SSL)

### Let's Encrypt con Certbot

El sistema usa Certbot para renovar certificados automáticamente:

```yaml
# En docker compose.yml:
certbot:
  image: certbot/certbot
  command: >
    /bin/sh -c
    'trap exit TERM; while :; do
      certbot renew --webroot -w /var/www/certbot;
      sleep 12h & wait $${!};
    done;'
```

### Certificados ubicados en

```
data/certbot/conf/
├── live/
│   └── emerald.2finternet.ar/
│       ├── cert.pem
│       ├── chain.pem
│       ├── fullchain.pem
│       └── privkey.pem
└── renewal/
    └── emerald.2finternet.ar.conf
```

### Verificar certificado

```bash
# Expiración
openssl x509 -in data/certbot/conf/live/emerald.2finternet.ar/cert.pem \
  -noout -dates

# Información completa
openssl x509 -in data/certbot/conf/live/emerald.2finternet.ar/cert.pem \
  -noout -text | head -30
```

---

## 4. Gestión de Secretos

### Variables de Entorno Sensibles

```bash
# Archivo .env (NUNCA commitear)
POSTGRES_PASSWORD=tu_contraseña_super_fuerte
POSTGRES_USER=admin
API_KEY=muy_secreta

MK_USER=admin_mikrotik
MK_PASS=contraseña_router

ISPCUBE_API_KEY=token_ispcube
SMARTOLT_API_KEY=token_smartolt
```

### Mejores Prácticas

✅ **Hacer:**
- Usar variables de entorno
- Rotación periódica de contraseñas
- Diferentes credenciales por ambiente
- Auditoría de accesos

❌ **Evitar:**
- Hardcodear secretos en el código
- Usar contraseñas por defecto
- Compartir .env por email/Slack
- Loguear credenciales

---

## 5. Base de Datos

### Conexión PostgreSQL

```python
# En config.py:
SQLALCHEMY_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@db:5432/{POSTGRES_DB}"
)

# Solo accesible internamente (Docker)
# En docker compose.yml:
ports:
  - "127.0.0.1:5432:5432"  # ← Bind solo a localhost
```

### Permisos de Usuario PostgreSQL

```sql
-- Crear usuario con permisos limitados (opcional)
CREATE USER app_user WITH PASSWORD 'app_pass';
GRANT CONNECT ON DATABASE emerald TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- O usar el usuario admin
ALTER ROLE admin WITH SUPERUSER;
```

---

## 6. Seguridad en Integraciones Externas

### Mikrotik

```python
# Nunca conectar sin SSL en producción
MK_ENABLE_SSL=true           # Usar puerto 8729
MK_PORT=8729                 # Puerto seguro

# Credenciales con permisos limitados
[admin@MikroTik] > /user/add name=emerald-sync group=read
[admin@MikroTik] > /user/set emerald-sync password=strong_password
```

### ISPCube / SmartOLT

```bash
# Usar API Keys en lugar de user/password
ISPCUBE_API_KEY=sk_live_abc123def456ghi789
SMARTOLT_API_KEY=sk_prod_xyz789abc456def

# Regenerar keys periódicamente (cada 6 meses recomendado)
```

---

## 7. Logging y Auditoría

### Eventos Auditados

```python
# En src/config.py:
logger.info("Autenticación exitosa desde 192.168.1.100")
logger.warning("Intento de acceso sin API Key")
logger.error("Fallo en conexión a Mikrotik")
```

### Ubicación de Logs

```
backend/data/logs/
├── app.log          # Logs de la aplicación
└── celery.log       # Logs de Celery
```

### Ver logs en tiempo real

```bash
docker compose logs -f backend
docker compose logs -f celery_worker
```

---

## 8. Rate Limiting

### Configuración Nginx

```nginx
# En nginx/default.conf:
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
    location /api/ {
        limit_req zone=general burst=20;
        proxy_pass http://backend:5000;
    }
    
    location /api/login {
        limit_req zone=auth burst=3;
        proxy_pass http://backend:5000;
    }
}
```

---

## 9. Headers de Seguridad

### Nginx Security Headers

```nginx
# En nginx/default.conf:
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

---

## 10. Checklist de Seguridad

### Antes de Ir a Producción

- [ ] API Key configurada y fuerte
- [ ] HTTPS/TLS activo
- [ ] Certificado SSL válido
- [ ] CORS restringido a dominios conocidos
- [ ] Contraseñas BD fuertes (>16 caracteres)
- [ ] Credenciales Mikrotik con permisos limitados
- [ ] Logs activados y monitoreados
- [ ] Rate limiting activado
- [ ] Backups automáticos configurados
- [ ] Monitoreo y alertas en place
- [ ] Documentación de políticas de seguridad

### Respuesta a Incidentes

1. **Credencial comprometida:**
   - Cambiar inmediatamente
   - Auditar accesos recientes
   - Notificar al equipo

2. **Ataque DDoS:**
   - Activar rate limiting agresivo
   - Contactar al proveedor de hosting
   - Revisar logs

3. **Brecha de datos:**
   - Aislar el sistema
   - Cambiar todas las credenciales
   - Notificar a los usuarios afectados

