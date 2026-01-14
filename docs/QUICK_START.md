# 🚀 Quick Start: API Keys + Entornos (30/12/2025)

**Para usuarios impacientes** - Comandos y referencias rápidas

---

## ⚡ Comandos Más Usados

### Ver estado de servicios
```bash
docker compose ps
```

### Ver logs de aplicación
```bash
docker compose logs -f backend
```

### Ver logs de Celery (tareas automáticas)
```bash
docker compose logs -f celery_worker
```

### Ver logs en tiempo real (hora local)
```bash
# Ahora con TZ sincronizado, ves la hora correcta (no UTC)
docker compose logs -f celery_worker | grep "2025-12-30 02:"
```

### Aplicar migraciones de BD
```bash
docker compose exec backend alembic upgrade head
```

---

## 🔑 API Keys: Flujo Rápido

### 1. Crear una API Key
```bash
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "ispcube_sync",
    "expires_days": 90,
    "scopes": ["ispcube:read", "ispcube:write"]
  }'
```

**Respuesta:** Se obtiene la key (ej: `iso_a1b2c3d4e5f6...`)

### 2. Usar en un request
```bash
curl http://localhost:8000/api/integrations \
  -H "X-API-Key: iso_a1b2c3d4e5f6..."
```

### 3. Rotar la key (cuando expire)
```bash
curl -X POST http://localhost:8000/admin/api-keys/rotate \
  -H "Content-Type: application/json" \
  -d '{"key_id": 1}'
```

### 4. Ver auditoría
```bash
curl http://localhost:8000/admin/api-keys/audit/all
```

---

## 🌍 Cambiar Entre Entornos

### Desarrollo → Preproducción

```bash
# 1. Editar .env
nano .env

# Cambiar de:
#   ENVIRONMENT=development
#   POSTGRES_PASSWORD=desarrollo2024
#   DOMAIN=localhost
#
# A:
#   ENVIRONMENT=preproduction
#   POSTGRES_PASSWORD=contraseña_aleatoria
#   DOMAIN=preprod.emerald.local

# 2. Reiniciar servicios
docker compose down
docker compose up -d

# 3. Aplicar migraciones
docker compose exec backend alembic upgrade head

# 4. Crear keys nuevas para preproducción
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{"client_name": "preprod_ispcube", "expires_days": 60}'
```

---

## 📊 Entender Qué Es Qué

### ENTORNOS

| Aspecto | Dev (Actual) | Preprod (Futuro) | Prod (Futuro) |
|---------|------|----------|------|
| **Server** | 138.59.172.26 | (Otro) | (Otro) |
| **RAM** | 4GB | 8GB | 16GB+ |
| **Variables** | Desarrollo | Testing | Producción |
| **Datos** | Testing | Reales | Reales |
| **Certificados** | Auto-generados | Let's Encrypt | Let's Encrypt |

### CÓMO CAMBIAS DE ENTORNO

- NO cambias archivos (código idéntico)
- SOLO cambias variables en `.env`
- Cada `.env` es diferente por server

```
┌─────────────────┐
│ .env (ÚNICA)    │ ← Cambias aquí
│                 │
├─ ENVIRONMENT    │ development / preproduction / production
├─ POSTGRES_PASS  │ Diferente en cada server
├─ API_KEY        │ Diferente en cada server
└─ DOMAIN         │ localhost / preprod.local / emerald.ar
```

---

## 🔄 Celery Tasks Automáticas

**Corren automáticamente con hora local correcta**

| Hora | Tarea | Qué hace |
|------|-------|----------|
| 1:00 AM | `api_keys.alert_expiring` | Alerta sobre keys vencidas |
| 2:00 AM | `api_keys.rotate_expiring` | Rota keys próximas a expirar |
| 3:00 AM | `nightly_sync_task` | Sincroniza datos (Mikrotik, ISPCube) |
| 3:30 AM | `api_keys.cleanup_expired` | Limpia keys expiradas |
| 4:00 AM (Domingo) | `api_keys.generate_audit_report` | Reporta cambios |

Para ver si se ejecutaron:
```bash
docker compose logs celery_worker | grep "2025-12-30 02:"
```

---

## 📚 Documentación Importante

**Lee estos archivos:**

1. **`docs/ENTORNOS.md`** ← Lee esto primero
   - Explica los 3 entornos
   - Cómo cambiar entre ellos
   - Comparativas

2. **`docs/SEGURIDAD.md`** - Autenticación y API Keys
3. **`docs/API_REFERENCE.md`** - Todos los endpoints
4. **`ESTADO_IMPLEMENTACION.md`** - Resumen de cambios
5. **`README.md`** - Inicio rápido

---

## 🎯 Tareas Típicas

### "Quiero crear una API Key"
```bash
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{"client_name": "mi_app", "expires_days": 90}'
```

### "Quiero ver todas las keys"
```bash
curl http://localhost:8000/admin/api-keys
```

### "Quiero saber quién cambió qué"
```bash
curl http://localhost:8000/admin/api-keys/audit/all
```

### "Quiero revocar una key"
```bash
curl -X DELETE http://localhost:8000/admin/api-keys/1
```

### "Quiero ver si Celery está corriendo"
```bash
docker compose logs celery_worker | tail -20
```

### "Quiero cambiar a preproducción"
```bash
nano .env                        # Cambiar variables
docker compose down && docker compose up -d  # Reiniciar
docker compose exec backend alembic upgrade head  # Migraciones
```

---

## ⚙️ Si Algo Falla

### "Celery no inicia"
```bash
docker compose logs celery_worker
# Buscar "ImportError" o "SyntaxError"
```

### "Logs en hora UTC (no local)"
```bash
# Revisar que docker compose.yml tiene:
# TZ: America/Argentina/Buenos_Aires

# Si no, edita docker compose.yml y reinicia
docker compose restart backend celery_worker
```

### "API Key no funciona"
```bash
# Verificar que existe
curl http://localhost:8000/admin/api-keys

# Verificar que no está expirada
# Si expiró, rotar
curl -X POST http://localhost:8000/admin/api-keys/rotate \
  -H "Content-Type: application/json" \
  -d '{"key_id": 1}'
```

### "¿Cuál es mi API Key?"
```bash
# No se muestra después de crear
# Debes guardarla en ese momento
# Si perdiste, rota la key para obtener una nueva

curl -X POST http://localhost:8000/admin/api-keys/rotate \
  -H "Content-Type: application/json" \
  -d '{"key_id": 1}'
```

---

## 🎓 Conceptos Clave

- **API Key**: Clave de acceso para integraciones (Mikrotik, ISPCube, etc)
- **Entorno**: dev/preprod/prod, diferenciados por `.env`
- **Migración**: `alembic upgrade head` aplica cambios de BD
- **Celery**: Ejecuta tareas automáticas en horarios (Beat)
- **Timezone**: TZ sincronizado a hora local (no UTC)
- **Auditoría**: Registro de quién cambió qué y cuándo

---

## 📞 Preguntas Rápidas

**P: ¿Dónde guardo la API Key?**  
R: En .env como variable de ambiente

**P: ¿La key expira?**  
R: Sí, según `expires_days` al crear

**P: ¿Puedo rotar todas las keys a la vez?**  
R: No, una por una. Pero Celery lo hace automáticamente

**P: ¿Puedo tener diferentes .env para dev y prod?**  
R: Sí, pero están en diferentes servers

**P: ¿Se sincronizan las keys entre servidores?**  
R: No, cada BD es independiente

**P: ¿Qué pasa si pierdo una key?**  
R: Rota la key para obtener una nueva, la vieja ya no funciona

---

**Última actualización:** 30 de diciembre de 2025  
**Estado:** ✅ 100% Funcional
