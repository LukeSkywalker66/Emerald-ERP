# 🌙 Módulo de Sincronización Nocturna (Nightly Sync)

## 📋 Resumen Ejecutivo

El **Módulo de Sincronización Nocturna** es un proceso automático programado con **Celery Beat** que se ejecuta diariamente a las **3:00 AM (Hora Argentina)** para nutrir la base de datos con datos actualizados desde múltiples fuentes externas:

- 🏢 **ISPCube:** Clientes, conexiones, planes
- 🔌 **Mikrotik:** PPP Secrets (usuarios PPPoE)
- 🌐 **SmartOLT:** ONUs (Optical Network Units)

El objetivo es tener la base de datos **lista y actualizada** cada mañana para que los operadores trabajen con información fresca sin retrasos.

---

## 🏗 Arquitectura de la Solución

### Componentes Clave

```
┌─────────────────────────────────────────────────────────────┐
│                    Celery Beat (Reloj)                      │
│         "A las 3:00 AM, ejecuta nightly_sync_task"          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Redis (Cola de Mensajes)                   │
│     (Guarda la orden "sincronizar ahora" en memoria)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Celery Worker (El Ejecutor)                    │
│  "Leo la orden de Redis y ejecuto nightly_sync_task.py"     │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┬────────────┐
        ▼          ▼          ▼            ▼
    ┌──────┐  ┌─────────┐  ┌────────┐  ┌─────────┐
    │ ISP- │  │ Mikrotik│  │SmartOLT│  │PostgreSQL
    │Cube  │  │ (RouterOS)│ │       │  │   (BD)
    └──────┘  └─────────┘  └────────┘  └─────────┘
```

### 📍 Ubicación del Código

| Componente | Ubicación | Descripción |
|-----------|-----------|------------|
| **Configuración de Celery** | `src/celery_app.py` | Define horarios (crontab), conexión a Redis, tareas registradas |
| **Lógica Principal** | `src/jobs/sync.py` | Función `nightly_sync_task()` y sus funciones helper |
| **Clientes API** | `src/clients/` | Módulos para conectar a ISPCube, Mikrotik, SmartOLT |
| **Base de Datos** | `src/db/postgres.py` | Acceso a PostgreSQL para leer/escribir datos |
| **Modelos** | `src/models/` | Definiciones de tablas (Node, PPPSecret, Subscriber, Plan, etc.) |
| **Programador** | `docker-compose.yml` | Servicio `celery_worker` que ejecuta Beat + Worker |

---

## ⚙️ Configuración de Horarios

### En `src/celery_app.py`

```python
celery_app.conf.beat_schedule = {
    "sync-nocturno-diario": {
        "task": "src.jobs.sync.nightly_sync_task",
        "schedule": crontab(hour=3, minute=0),  # 3:00 AM todos los días
    },
}
```

### Zona Horaria
```python
celery_app.conf.update(
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,  # Celery internamente usa UTC, pero interpreta según timezone
)
```

**Nota:** Si ajustas la hora, recuerda reiniciar el contenedor `celery_worker`:
```bash
docker compose restart celery_worker
```

---

## 🔄 Flujo de Ejecución de `nightly_sync_task()`

```python
@celery_app.task(name="src.jobs.sync.nightly_sync_task", bind=True)
def nightly_sync_task(self):
    """
    Sincronización nocturna (Celery Beat).
    Se ejecuta automáticamente cada día a las 3:00 AM (Argentina).
    """
    
    # 1. Inicializar BD
    init_db()
    db = Database()
    
    # 2. PASO 1: Sincronizar Nodos (ISPCube)
    # └─ Limpia tabla nodes
    # └─ Consulta ISPCube API
    # └─ Inserta/Actualiza registros
    sync_nodes(db)
    
    # 3. PASO 2: Sincronizar PPP Secrets (Mikrotik)
    # └─ Para cada nodo, conecta a RouterOS
    # └─ Obtiene lista de usuarios PPPoE
    # └─ Guarda en tabla ppp_secrets
    sync_secrets(db)
    
    # 4. PASO 3: Sincronizar ONUs (SmartOLT)
    # └─ Consulta SmartOLT API
    # └─ Obtiene lista de subscribers/ONUs
    sync_onus(db)
    
    # 5. PASO 4: Sincronizar Planes (ISPCube)
    # └─ Obtiene catálogo de planes
    sync_plans(db)
    
    # 6. PASO 5: Sincronizar Conexiones (ISPCube)
    # └─ Obtiene conexiones activas por cliente
    sync_connections(db)
    
    # 7. PASO 6: Sincronizar Clientes (ISPCube)
    # └─ Obtiene datos demográficos
    # └─ Enriquece la tabla customers
    sync_clientes(db)
    
    # 8. Log de Auditoría
    # └─ Registra duración, errores, cantidad de registros
    logger.info(f"✅ Sync completada en {duration_seconds}s")
```

---

## 📦 Funciones Helper en `src/jobs/sync.py`

### 1. `sync_nodes(db)`
**Propósito:** Sincronizar nodos ISP desde ISPCube

**Fuente:** ISPCube API (`/api/nodos`)

**Acción:**
- Limpia tabla `nodes`
- Consulta lista de nodos
- Inserta cada nodo con: `id`, `name`, `ip`, `puerto`

**Tabla destino:** `nodes` (Node)

**Ejemplo de datos:**
```json
{
  "id": "NODE01",
  "name": "Nodo Centro",
  "ip": "192.168.1.100",
  "puerto": 8728
}
```

---

### 2. `sync_secrets(db)`
**Propósito:** Sincronizar usuarios PPPoE desde Mikrotik

**Fuente:** Mikrotik API (`/ppp/secret`)

**Acción:**
- Para cada nodo registrado:
  - Conecta a RouterOS en esa IP
  - Obtiene lista de PPP Secrets
  - Guarda usuario, perfil, última conexión, etc.

**Tabla destino:** `ppp_secrets` (PPPSecret)

**Ejemplo de datos:**
```json
{
  "name": "juan_perez",
  "profile": "PLAN_50",
  "service": "pppoe",
  "comment": "Casilda 123, Piso 2",
  "last_caller_id": "192.168.100.50",
  "last_logged_out": "2025-12-29T14:23:00Z"
}
```

---

### 3. `sync_onus(db)`
**Propósito:** Sincronizar ONUs desde SmartOLT

**Fuente:** SmartOLT API

**Acción:**
- Consulta lista de subscribers/ONUs
- Obtiene estado de conexión (online/offline)
- Guarda información de velocidad, señal, etc.

**Tabla destino:** `subscribers` (Subscriber)

---

### 4. `sync_plans(db)`
**Propósito:** Sincronizar planes disponibles desde ISPCube

**Fuente:** ISPCube API (`/api/planes`)

**Acción:**
- Limpia tabla `plans`
- Consulta catálogo de planes
- Inserta: `plan_id`, `name`, `download_speed`, `upload_speed`

**Tabla destino:** `plans` (Plan)

**Ejemplo de datos:**
```json
{
  "id": "PLAN_50",
  "name": "Plan 50Mb",
  "download": 50,
  "upload": 10
}
```

---

### 5. `sync_connections(db)`
**Propósito:** Sincronizar conexiones activas desde ISPCube

**Fuente:** ISPCube API (`/api/conexiones`)

**Acción:**
- Consulta conexiones por cliente
- Obtiene: ID conexión, usuario PPPoE, plan, dirección, estado

**Tabla destino:** `connections` (Connection)

---

### 6. `sync_clientes(db)`
**Propósito:** Sincronizar clientes desde ISPCube

**Fuente:** ISPCube API (`/api/clientes`)

**Acción:**
- Consulta lista de clientes
- Obtiene: nombre, dirección, email, teléfono, estado
- Enriquece la BD con datos demográficos

**Tabla destino:** `customers` (Customer)

---

## 🚀 Cómo Ejecutar Manualmente

Si necesitas sincronizar **ahora** sin esperar a las 3:00 AM:

### Opción 1: Desde el contenedor

```bash
# Acceder al contenedor backend
docker compose exec backend bash

# Ejecutar la tarea inmediatamente
python -c "from src.jobs.sync import nightly_sync_task; nightly_sync_task()"
```

### Opción 2: Usar Celery delay

```bash
docker compose exec backend python -c \
  "from src.jobs.sync import nightly_sync_task; nightly_sync_task.delay()"
```

### Opción 3: Ver estado en tiempo real

```bash
# Terminal 1: Ver logs del worker
docker compose logs -f celery_worker

# Terminal 2: Triggerear sync (otra ventana)
docker compose exec backend python -c \
  "from src.jobs.sync import nightly_sync_task; nightly_sync_task.delay()"
```

---

## 📊 Monitoreo y Logs

### Ubicación de Logs

```bash
# Logs del worker en tiempo real
docker compose logs celery_worker

# Logs históricos de sync
docker compose logs --tail=100 celery_worker | grep "\[SYNC\]"
```

### Ejemplo de Log Exitoso

```
=================================================================================
🚀 [SYNC] INICIANDO SINCRONIZACIÓN NOCTURNA
   Timestamp: 2025-02-09T03:00:00.000000
=================================================================================
📦 [1/6] Sincronizando nodos ISPCube...
   ↳ Buscando Nodos en ISPCube... ✅ (5 encontrados)
   ✅ 5 nodos en BD

📦 [2/6] Sincronizando secrets Mikrotik...
   ↳ Consultando 5 Mikrotiks:
      > Nodo Centro (192.168.1.100)... ✅ (234)
   ✅ 1170 secrets en BD

📦 [3/6] Sincronizando ONUs SmartOLT...
   ↳ Conectando a SmartOLT... ✅ (456 ONUs)
   ✅ 456 ONUs en BD

📦 [4/6] Sincronizando planes ISPCube...
   ↳ Buscando Planes en ISPCube... ✅ (12 encontrados)
   ✅ 12 planes en BD

📦 [5/6] Sincronizando conexiones ISPCube...
   ↳ Buscando Conexiones en ISPCube... ✅ (890 encontradas)
   ✅ 890 conexiones en BD

📦 [6/6] Sincronizando clientes ISPCube...
   ↳ Buscando Clientes en ISPCube... ✅ (1234 encontrados)
   ✅ 1234 clientes en BD

=================================================================================
✅ [SYNC] SINCRONIZACIÓN COMPLETADA
   Duración: 45.23 segundos
   Nodos: 5 | Secrets: 1170 | ONUs: 456 | Planes: 12 | Conexiones: 890 | Clientes: 1234
=================================================================================
```

### Ejemplo de Log con Error

```
📦 [2/6] Sincronizando secrets Mikrotik...
   ↳ Consultando 5 Mikrotiks:
      > Nodo Centro (192.168.1.100)... ⚠️ TimeOut después de 10s
      > Nodo Norte (192.168.1.101)... ✅ (234)
      > Nodo Sur (192.168.1.102)... ❌ Error: Conexión rechazada

⚠️ ADVERTENCIA: No todos los Mikrotiks respondieron
✅ Sync completada parcialmente: 234/1170 secrets sincronizados
```

---

## ⚠️ Manejo de Errores y Resiliencia

### Estrategia

La sincronización está diseñada para ser **tolerante a fallos**:

1. **Si una fuente falla**, continúa con las demás
2. **Registra el error** en logs para auditoría
3. **No rollback:** Mantiene los datos sincronizados parcialmente
4. **Reintenta:** La siguiente noche vuelve a intentar

### Ejemplo: ISPCube offline

```python
try:
    clientes = ispcube.obtener_clientes()
except Exception as e:
    logger.warning(f"⚠️ ISPCube offline: {e}")
    # Continúa con el resto de la sincronización
    # Los clientes se actualizan en el siguiente ciclo
```

### Ejemplo: Mikrotik unreachable

```python
for node in nodes:
    try:
        secrets = mikrotik.get_all_secrets(node.ip, node.port)
    except TimeoutError:
        logger.warning(f"⚠️ Mikrotik {node.name} timeout")
        # Continúa con el siguiente nodo
```

---

## 🔐 Configuración de Credenciales

### Variables de Entorno (`.env`)

```bash
# ISPCube
ISPCUBE_API_URL=http://ispcube.local:8080
ISPCUBE_API_KEY=abc123def456

# Mikrotik (RouterOS)
MK_HOST=192.168.1.100
MK_PORT=8728
MK_USER=admin
MK_PASS=admin123
MK_ENABLE_SSL=false  # true si usas puerto 8729

# SmartOLT
SMARTOLT_URL=http://smartolt.local:8080
SMARTOLT_API_KEY=xyz789

# Redis (para Celery)
REDIS_URL=redis://redis:6379/0

# PostgreSQL (base de datos local)
DATABASE_URL=postgresql://user:password@db:5432/emerald
```

### En Docker Compose

```yaml
celery_worker:
  environment:
    - ISPCUBE_API_URL=http://192.168.1.100:8080
    - ISPCUBE_API_KEY=${ISPCUBE_API_KEY}
    - MK_HOST=192.168.1.100
    - MK_USER=admin
    - MK_PASS=${MK_PASS}
```

---

## 🛠 Troubleshooting

### Problema: Sync no se ejecuta a las 3:00 AM

**Posible causa:** Beat no está corriendo

```bash
# Verificar que el worker está ejecutándose
docker compose ps celery_worker

# Ver logs
docker compose logs celery_worker | grep "beat"

# Reiniciar
docker compose restart celery_worker
```

### Problema: Sincronización muy lenta

**Posible causa:** Alguna fuente responde lentamente

```bash
# Aumentar timeout en sync.py
timeout = 30  # Aumentar de 10 a 30 segundos

# O ejecutar sync solo para nodos críticos
sync_nodes(db)      # ✅ Obligatorio
sync_plans(db)      # ✅ Importante
sync_secrets(db)    # ⏸ Opcional durante mantenimiento
```

### Problema: Base de datos creció demasiado

**Solución:** Limpiar datos antiguos

```bash
# Mantener solo últimos 30 días de sync logs
DELETE FROM sync_logs WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 📈 Monitoreo Avanzado

### Crear una vista de última sincronización

```sql
CREATE VIEW last_sync_info AS
SELECT 
  source,
  COUNT(*) as records,
  MAX(updated_at) as last_sync
FROM (
  SELECT 'nodes' as source, updated_at FROM nodes
  UNION ALL
  SELECT 'ppp_secrets' as source, updated_at FROM ppp_secrets
  UNION ALL
  SELECT 'customers' as source, updated_at FROM customers
) data
GROUP BY source
ORDER BY last_sync DESC;
```

### Dashboard en Grafana

```sql
SELECT 
  DATE_TRUNC('hour', updated_at) as period,
  COUNT(*) as sync_count
FROM sync_logs
WHERE source = 'ispcube'
GROUP BY period
ORDER BY period DESC;
```

---

## 📚 Documentación Relacionada

- [INTEGRACIONES.md](./INTEGRACIONES.md) - Detalles de APIs externas
- [MANUAL_SYNC.md](./MANUAL_SYNC.md) - Comandos básicos de Celery
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Cómo deployar con Celery
- [ARQUITECTURA_TICKETS_V2.md](./ARQUITECTURA_TICKETS_V2.md) - Modelos de datos

---

## ✅ Checklist de Implementación

- [x] Celery Beat programado a las 3:00 AM
- [x] Redis configurado como broker
- [x] Sincronización de nodos (ISPCube)
- [x] Sincronización de secrets (Mikrotik)
- [x] Sincronización de ONUs (SmartOLT)
- [x] Sincronización de planes
- [x] Sincronización de conexiones
- [x] Sincronización de clientes
- [x] Manejo de errores y logs
- [ ] Monitoreo en Grafana
- [ ] Alertas en caso de fallo
- [ ] Backup automático post-sync

---

**Última actualización:** 9 de febrero de 2026 (revisado 02 Jun 2026)  
**Responsable:** Equipo Backend Emerald ERP
