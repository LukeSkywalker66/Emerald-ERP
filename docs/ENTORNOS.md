# 🌍 Guía de Entornos: Desarrollo, Preproducción y Producción

**Última actualización:** 30 de diciembre de 2025  
**Estado:** Todas las implementaciones funcionando

---

## 📋 Resumen Rápido

Emerald ERP corre en **3 entornos diferentes** según tu necesidad:

| Entorno | Servidor | Specs | Propósito |
|---------|----------|-------|----------|
| **DESARROLLO** | Debian local | 4GB RAM, 2 cores, 50GB disco | Código nuevo, testing, debugging |
| **PREPRODUCCIÓN** | Debian virtual | 8GB RAM, 4 cores, 100GB disco | Validación antes de producción, carga de datos reales |
| **PRODUCCIÓN** | (Futuro) | 16GB+ RAM, 8+ cores | Sistema en vivo para usuarios finales |

---

## 🛠️ Cómo Funciona: Un Solo `.env` para Todo

**NO hay múltiples `.env` files (.env.development, .env.production, etc)**

En su lugar, **un único `.env`** que cambias según el entorno donde despliegas.

### Flujo de Configuración

```
┌──────────────────┐
│   .env (único)   │ ← Cambias variables según entorno
└────────┬─────────┘
         │
         ├─→ En DESARROLLO: Variables de desarrollo
         ├─→ En PREPRODUCCIÓN: Variables de preprod
         └─→ En PRODUCCIÓN: Variables de producción

┌────────────────────────────┐
│   docker compose.yml       │ ← Lee del .env
│   (igual en todos lados)   │
└────────────────────────────┘
```

### Archivos Que Cambian por Entorno

```
❌ NO CAMBIAN (iguales en todos lados):
   - docker compose.yml
   - Dockerfile (backend + frontend)
   - Código Python/JavaScript
   - Migraciones de BD

✅ CAMBIAN (diferentes por entorno):
   - .env (variables de configuración)
   - Certificados SSL (producción)
   - Backups/logs (ubicación diferente)
```

---

## 🖥️ DESARROLLO: Tu Servidor Local (138.59.172.26)

### Configuración Actual

```bash
# Ubicación
/opt/emerald-erp/

# Servidor
Debian Linux (4GB RAM, 2 cores, 50GB disco)

# IP
138.59.172.26

# Containers activos
docker compose ps
→ backend, frontend, db, redis, celery_worker, nginx, beholder
```

### Archivo `.env` para DESARROLLO

```bash
# === DATABASE (LOCAL) ===
POSTGRES_USER=admin
POSTGRES_PASSWORD=desarrollo2024  # Simple, solo dev
POSTGRES_DB=emerald

# === BACKEND (LOCAL) ===
API_KEY=dev_key_simple_123456
ENVIRONMENT=development  # ← CLAVE

# === MIKROTIK (REAL) ===
MK_HOST=192.168.1.100
MK_PORT=8728
MK_USER=admin
MK_PASS=tu_contraseña_real

# === ISPCUBE (REAL) ===
ISPCUBE_API_URL=http://192.168.1.50:8080
ISPCUBE_API_KEY=tu_api_key_real

# === FRONTEND ===
VITE_API_URL=/api  # Acceso local

# === JWT API KEYS (NUEVO SISTEMA) ===
SECRET_KEY=dev_secret_key_for_jwt_12345
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30

# === SERVIDOR ===
DOMAIN=localhost
```

### Cómo Levantar

```bash
cd /opt/emerald-erp

# Levantar todo
docker compose up -d

# Verificar
docker compose ps
docker compose logs -f backend

# Aplicar migraciones
docker compose exec backend alembic upgrade head

# Ver logs con timezone local
docker compose logs celery_worker | grep "2025-12-30 02:" # Buscar a las 2am
```

### Características en DESARROLLO

✅ **Hot reload** - Cambios en código se reflejan automáticamente  
✅ **Debug mode** - Puedes inspeccionar requests/responses  
✅ **Migración automática** - Alembic auto-genera cambios de schema  
✅ **Logs detallados** - Sin limpieza, todo queda registrado  
✅ **Timezone local** - TZ=America/Argentina/Buenos_Aires en docker compose.yml  

### API Keys en DESARROLLO

```bash
# Crear una API Key de prueba
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "ispcube_test",
    "expires_days": 90,
    "scopes": ["ispcube:read", "ispcube:write"]
  }'

# Respuesta (ejemplo)
{
  "id": 1,
  "client_name": "ispcube_test",
  "key": "iso_a1b2c3d4e5f6g7h8i9j0...",
  "prefix": "iso_a1b2c3",
  "created_at": "2025-12-30T09:20:00",
  "expires_at": "2026-03-30T09:20:00",
  "scopes": ["ispcube:read", "ispcube:write"],
  "rotation_count": 0
}

# Usar la key en requests
curl http://localhost:8000/api/integrations \
  -H "X-API-Key: iso_a1b2c3d4e5f6g7h8i9j0..."
```

### Celery Worker en DESARROLLO

```bash
# Ver que está ejecutándose
docker compose logs -f celery_worker

# Schedules configuradas (con hora local):
# - 01:00 AM → Alertas de API Keys por expirar
# - 02:00 AM → Rotación automática de API Keys
# - 03:00 AM → Sincronización nocturna con Mikrotik/ISPCube
# - 03:30 AM → Limpieza de API Keys expiradas
# - 04:00 AM (Domingos) → Reporte de auditoría de API Keys
```

---

## 🔄 PREPRODUCCIÓN: Servidor de Validación (Futuro)

> **Nota:** Aún no desplegado, pero se usará cuando esté listo para testing con datos reales

### Configuración Planeada

```bash
# Ubicación (diferente servidor)
/opt/emerald-erp/

# Servidor
Debian Linux (8GB RAM, 4 cores, 100GB disco)

# IP
(Asignada luego)

# Containers
Mismos que desarrollo, pero con más recursos
```

### Archivo `.env` para PREPRODUCCIÓN

```bash
# === DATABASE (PREPROD) ===
POSTGRES_USER=emerald_preprod
POSTGRES_PASSWORD=contraseña_fuerte_aleatoria_$(openssl rand -hex 16)
POSTGRES_DB=emerald_preprod

# === BACKEND ===
API_KEY=preprod_key_aleatoria
ENVIRONMENT=preproduction  # ← CLAVE

# === INTEGRACIONES (REALES) ===
MK_HOST=192.168.1.100      # Mismo Mikrotik que dev
MK_PORT=8728
MK_USER=admin
MK_PASS=tu_contraseña_real

ISPCUBE_API_URL=http://192.168.1.50:8080
ISPCUBE_API_KEY=tu_api_key_real

# === FRONTEND ===
VITE_API_URL=/api

# === JWT API KEYS ===
SECRET_KEY=$(openssl rand -base64 32)  # Diferente de dev
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60  # Más largo que en dev

# === SERVIDOR ===
DOMAIN=preprod.emerald.local
```

### Cómo Desplegar a PREPRODUCCIÓN

```bash
# 1. Conectar al servidor de preprod
ssh usuario@ip_preprod

# 2. Clonar/actualizar código
cd /opt/emerald-erp
git pull origin develop  # Rama de desarrollo

# 3. Actualizar .env
nano .env  # Cambiar variables a valores de preprod

# 4. Levantar servicios
docker compose up -d

# 5. Aplicar migraciones
docker compose exec backend alembic upgrade head

# 6. Generar primera API Key
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{"client_name": "preprod_ispcube", "expires_days": 90}'

# 7. Validar
docker compose ps
docker compose logs -f backend
```

### Diferencias con DESARROLLO

| Aspecto | Desarrollo | Preproducción |
|---------|-----------|-----------------|
| **RAM** | 4GB | 8GB |
| **CPU** | 2 cores | 4 cores |
| **Logs** | Verbosos | Menos verbosos |
| **Backups** | Manual | Diarios automáticos (planeado) |
| **Monitoreo** | Básico | Avanzado (Grafana) |
| **Base de datos** | Pequeña (dev) | Grande (datos reales) |
| **Certificados SSL** | Self-signed | Válidos (Let's Encrypt) |

---

## 🚀 PRODUCCIÓN: Sistema en Vivo (Futuro)

> **Nota:** Aún no desplegado. Se activa cuando el sistema esté 100% validado

### Configuración

```bash
# === DATABASE (PROD) ===
POSTGRES_USER=emerald_prod
POSTGRES_PASSWORD=contraseña_super_segura
POSTGRES_DB=emerald_prod

# === BACKEND ===
API_KEY=prod_key_super_aleatoria
ENVIRONMENT=production  # ← CLAVE (crítico)

# === INTEGRACIONES (PROD) ===
MK_HOST=ip_router_produccion
MK_PASS=contraseña_prod

# === FRONTEND ===
VITE_API_URL=/api

# === JWT (DIFERENTE DE DEV/PREPROD) ===
SECRET_KEY=$(openssl rand -base64 64)  # Mucho más largo
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440  # 24 horas

# === SERVIDOR ===
DOMAIN=emerald.2finternet.ar  # Dominio real

# === SEGURIDAD ===
DEBUG=false
CORS_ORIGINS=https://emerald.2finternet.ar
```

### Cambios de Configuración para PRODUCCIÓN

```python
# backend/src/main.py
app = FastAPI(
    title="Emerald ERP",
    docs_url=None,  # ✅ Desactivar /docs en producción
    redoc_url=None  # ✅ Desactivar /redoc
)

# Configurar CORS estrictamente
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://emerald.2finternet.ar"],  # Solo el dominio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Cómo Desplegar a PRODUCCIÓN

```bash
# ⚠️ PRERREQUISITOS CRÍTICOS
# 1. Backup completo de datos
# 2. Validación en preproducción (mínimo 2 semanas)
# 3. Certificados SSL válidos
# 4. Plan de rollback documentado

# 1. Conectar al servidor de producción
ssh usuario@ip_prod

# 2. Clonar/actualizar código
cd /opt/emerald-erp
git pull origin master  # ← Rama de PRODUCCIÓN (NO develop)

# 3. Actualizar .env con credenciales de PROD
nano .env

# 4. Backup de BD actual
docker compose exec db pg_dump -U emerald_prod emerald_prod > backup_prod_$(date +%Y%m%d_%H%M%S).sql

# 5. Levantar servicios
docker compose up -d

# 6. Aplicar migraciones
docker compose exec backend alembic upgrade head

# 7. Verificar certificados SSL
curl -I https://emerald.2finternet.ar

# 8. Monitorear durante 1 hora
docker compose logs -f

# 9. Alertar a admins que producción está UP
```

---

## 🔐 API KEYS: Cómo Cambia por Entorno

### Sistema de API Keys (Nuevo en Dec 2025)

El sistema de API Keys funciona **igual en todos los entornos**, pero con diferencias:

#### DESARROLLO

```bash
# Crear key de prueba (rápido, seguridad baja)
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "test_key",
    "expires_days": 7,  # Corto para testing rápido
    "scopes": ["*"]     # Todos los permisos
  }'

# Usar en desarrollo
export API_KEY="iso_xxxxx..."
curl http://localhost:8000/api/integrations \
  -H "X-API-Key: $API_KEY"
```

#### PREPRODUCCIÓN

```bash
# Keys con más validación
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "preprod_ispcube",
    "expires_days": 60,  # Más tiempo
    "scopes": ["ispcube:read", "ispcube:write"]  # Específicos
  }'

# Guardar en .env y documentar
echo "ISPCUBE_API_KEY=iso_xxxxx..." >> .env
```

#### PRODUCCIÓN

```bash
# Keys con validación máxima y seguridad
curl -X POST https://emerald.2finternet.ar/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "prod_ispcube_live",
    "expires_days": 90,        # Rotación regular
    "scopes": ["ispcube:read"]  # Mínimos permisos necesarios
  }'

# Guardar SOLO en servidor (no en git)
ssh usuario@prod_ip "echo 'ISPCUBE_API_KEY=iso_xxxxx...' >> /opt/emerald-erp/.env"

# Verificar auditoria
curl https://emerald.2finternet.ar/admin/api-keys/audit/all \
  -H "X-API-Key: $ADMIN_KEY"
```

### Rotación de Keys por Entorno

#### DESARROLLO
- Manual (cuando quieras)
- Automática: Cada 7 días (corto para testing)

#### PREPRODUCCIÓN
- Manual (recomendado)
- Automática: Cada 30 días

#### PRODUCCIÓN
- Manual (requiere aprobación)
- Automática: Cada 90 días
- Con notificación a admin

### Celery Tasks (Automáticas)

```
Igual en todos lados, pero con TZ=America/Argentina/Buenos_Aires

1:00 AM (cada 3 días) → Alertas de expiración
2:00 AM (diario)      → Rotación automática
3:00 AM (diario)      → Sincronización nocturna
3:30 AM (diario)      → Limpieza de keys expiradas
4:00 AM (domingo)     → Reporte de auditoría
```

---

## 📊 Comparativa Completa

| Aspecto | Desarrollo | Preproducción | Producción |
|---------|-----------|-----------------|-----------|
| **Servidor IP** | 138.59.172.26 | (Pendiente) | (Futuro) |
| **RAM** | 4 GB | 8 GB | 16+ GB |
| **CPU** | 2 cores | 4 cores | 8+ cores |
| **Disco** | 50 GB | 100 GB | 500+ GB |
| **Base de datos** | Pequeña | Real | Producción |
| **SSL** | Auto-generado | Let's Encrypt | Let's Encrypt |
| **Backups** | Manual | Diarios (planeado) | Horarios |
| **Monitoreo** | Logs básicos | Grafana | Grafana + Alertas |
| **API Keys** | Corta vida | Media vida | Larga vida |
| **Hot-reload** | ✅ Sí | ❌ No | ❌ No |
| **Debug mode** | ✅ Sí | ❌ No | ❌ No |
| **Docs OpenAPI** | ✅ /docs | ❌ Desactivado | ❌ Desactivado |
| **CORS** | Permisivo | Restringido | Muy restringido |

---

## 🚀 Flujo de Cambios: Dev → Preprod → Prod

```
┌──────────────────────┐
│  Rama: develop       │
│  Servidor: Dev       │
│  (Tu máquina local)  │
└──────────┬───────────┘
           │
           │ 1. Desarrollas feature
           │ 2. Testing local
           │ 3. Commit → develop
           │
           ▼
┌──────────────────────┐
│  Rama: develop       │
│  Servidor: Preprod   │
│  (Validación)        │
└──────────┬───────────┘
           │
           │ 4. Pull de develop
           │ 5. Testing real con datos
           │ 6. Merging a master
           │
           ▼
┌──────────────────────┐
│  Rama: master        │
│  Servidor: Prod      │
│  (Sistema vivo)      │
└──────────────────────┘
```

### Git Branches

```bash
# DESARROLLO
git checkout develop
git add .
git commit -m "feat: nueva feature"
git push origin develop

# PREPRODUCCIÓN (cuando listo)
git checkout master
git pull origin develop
git commit -m "release: v1.0.0"
git push origin master

# PRODUCCIÓN (deploy)
git pull origin master
docker compose up -d
```

---

## 🛠️ Troubleshooting por Entorno

### En DESARROLLO: "Los logs están en UTC, no en hora local"
```bash
# ✅ SOLUCIONADO en docker compose.yml
# Agregamos: TZ=America/Argentina/Buenos_Aires

docker compose restart backend celery_worker
```

### En PREPRODUCCIÓN: "¿Cómo cambio la BD a datos reales?"
```bash
# 1. Backup de la BD actual
docker compose exec db pg_dump -U emerald_preprod emerald_preprod > backup.sql

# 2. Importar datos reales
psql -U emerald_preprod -d emerald_preprod < datos_reales.sql

# 3. Verificar
docker compose exec db psql -U emerald_preprod -d emerald_preprod -c "SELECT COUNT(*) FROM clientes;"
```

### En PRODUCCIÓN: "¿Necesito cambiar el .env?"
```bash
# ✅ SÍ, completamente
# El .env de PRODUCCIÓN tiene:
# - Credenciales diferentes
# - Dominios reales
# - URLs de integraciones correctas
# - JWT_SECRET mucho más largo
# - ENVIRONMENT=production

# ⚠️ NUNCA commitees el .env de producción
# ⚠️ GUÁRDALO SEGURO EN EL SERVIDOR
```

---

## 📞 Preguntas Frecuentes

### ¿Puedo tener 2 BD diferentes (dev + prod)?
**Sí**, usando directorios diferentes para volumes de PostgreSQL:

```yaml
# docker compose.yml
db:
  volumes:
    - postgres_data_${ENVIRONMENT}:/var/lib/postgresql/data  # Varía por .env
```

### ¿Cómo migro de desarrollo a preproducción?
```bash
# 1. Exportar datos de dev
docker compose exec db pg_dump > dev_export.sql

# 2. En preproducción, importar
psql -U emerald_preprod < dev_export.sql
```

### ¿Qué sucede si olvido cambiar una variable en .env?
El contenedor **fallará en startup** si faltan variables críticas. Docker te mostrará un error.

### ¿Puedo tener dev y preprod en el mismo servidor?
**No recomendado**, pero si es necesario:
```bash
# Diferentes puertos para cada uno
# Dev: localhost:8000
# Preprod: localhost:8001

# O diferentes containers con names únicos
```

---

## ✅ Checklist de Migración

### De DESARROLLO a PREPRODUCCIÓN
- [ ] Código testeado en develop
- [ ] Base de datos limpia o con datos de testing
- [ ] `.env` actualizado con credenciales de preprod
- [ ] Certificados SSL configurados
- [ ] Backup de BD anterior
- [ ] docker compose pull (para actualizar imágenes)
- [ ] Migraciones aplicadas: `alembic upgrade head`
- [ ] API Keys configuradas para preprod
- [ ] Logs monitorizados durante 1 hora
- [ ] Integraciones (Mikrotik, ISPCube) testeadas

### De PREPRODUCCIÓN a PRODUCCIÓN
- [ ] 2 semanas mínimo testeando en preprod
- [ ] Todas las integraciones validadas
- [ ] Plan de rollback documentado
- [ ] Backup completo de preprod
- [ ] Equipo de soporte en standby
- [ ] Certificado SSL válido (Let's Encrypt)
- [ ] Rama `master` actualizada
- [ ] `.env` de producción en servidor (no en git)
- [ ] CORS configurado correctamente
- [ ] Monitoring/Alertas activados
- [ ] DNS apuntando correctamente

---

## 🎓 Conceptos Clave

**ENVIRONMENT variable** → Define dónde estás (development/preproduction/production)  
**Rama (branch)** → `develop` para dev, `master` para prod  
**API Key** → Token para acceso a endpoints, diferente por entorno  
**Celery Schedule** → Tareas automáticas (iguales en todos lados, hora local)  
**Timezone** → TZ=America/Argentina/Buenos_Aires (configurado en docker compose)  

---

## 📚 Documentación Relacionada

- [DESARROLLO_LOCAL.md](./DESARROLLO_LOCAL.md) - Guía detallada de desarrollo
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Pasos para deployment
- [SEGURIDAD.md](./SEGURIDAD.md) - Sistema de API Keys y autenticación
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints disponibles

---

**¿Dudas sobre los entornos?** Revisa los logs y verifica que la variable `ENVIRONMENT` en `.env` sea correcta.
