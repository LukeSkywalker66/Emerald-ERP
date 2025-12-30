# 🗄️ Arquitectura de Base de Datos

## Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENTES (ISPCube)                         │
├─────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                   │
│ - code (STRING, UNIQUE)          # Código único de cliente      │
│ - name (STRING)                  # Nombre del cliente           │
│ - doc_number (STRING)            # DNI/CUIT                    │
│ - address (STRING)               # Domicilio                    │
│ - status (STRING)                # active/inactive/suspended    │
│ - raw_data (JSONB)               # Datos originales de ISPCube │
│ - created_at (TIMESTAMP)         # Fecha de creación           │
│ - updated_at (TIMESTAMP)         # Última actualización        │
└─────────────────────────────────────────────────────────────────┘
                           1 │ * (1:N)
                             │
                    ┌────────▼─────────┐
                    │  CONNECTIONS     │
                    │  (ISPCube)       │
                    ├──────────────────┤
                    │ PK: id           │
                    │ FK: customer_id  │
                    │ FK: node_id      │
                    │ FK: plan_id      │
                    │ - pppoe_username │
                    │ - direccion      │
                    │ - created_at     │
                    └──────────────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
        ┌───────────▼──────────┐  ┌───▼──────────────────┐
        │   SUBSCRIBERS        │  │  NODES               │
        │ (SmartOLT/Mikrotik)  │  │ (ISPCube/Mikrotik)   │
        ├──────────────────────┤  ├──────────────────────┤
        │ PK: id               │  │ PK: node_id (STR)    │
        │ - unique_external_id │  │ - name               │
        │ - sn (ONU SN)        │  │ - ip_address         │
        │ - olt_name           │  │ - puerto (API)       │
        │ - olt_id             │  │ - created_at         │
        │ - board              │  └──────────────────────┘
        │ - port               │
        │ - onu                │
        │ - onu_type_id        │
        │ - pppoe_username     │
        │ - mode               │
        │ - vlan               │
        └──────────────────────┘

        ┌──────────────────────┐
        │ PPP_SECRETS          │
        │ (Mikrotik)           │
        ├──────────────────────┤
        │ PK: id               │
        │ FK: router_ip        │
        │ - name (username)    │
        │ - password           │
        │ - profile            │
        │ - service            │
        │ - comment            │
        │ - last_caller_id     │
        │ - last_logged_out    │
        │ - created_at         │
        │ - updated_at         │
        └──────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 PLANS (ISPCube)                          │
├──────────────────────────────────────────────────────────┤
│ PK: plan_id (STRING, UNIQUE)                             │
│ - name (STRING)          # Ej: "Plan 50MB"              │
│ - speed (INT)            # Velocidad en Mbps            │
│ - description (TEXT)     # Descripción                   │
│ - created_at (TIMESTAMP) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              SYNC_STATUS (Auditoría)                     │
├──────────────────────────────────────────────────────────┤
│ PK: id                                                   │
│ - fuente (STRING)        # ispcube / mikrotik / smartolt │
│ - estado (STRING)        # success / error / partial     │
│ - detalle (TEXT)         # Mensaje de error o resumen    │
│ - registros_procesados   # Cantidad de filas             │
│ - timestamp (TIMESTAMP)  │
└──────────────────────────────────────────────────────────┘
```

---

## Relaciones Principales

### 1. Cliente → Conexión → Nodo
```
Cliente (ISPCube)
  ↓ tiene
Conexión
  ↓ usa
Node (Router)
```

### 2. Conexión → PPP Secret (Mikrotik)
```
Conexión (pppoe_username)
  ↓ coincide con
PPP_Secret (name)
  ↓ en
Router (router_ip)
```

### 3. Conexión → Subscriber → ONU (SmartOLT)
```
Conexión (pppoe_username)
  ↓ coincide con
Subscriber (pppoe_username)
  ↓ is
ONU (unique_external_id)
```

---

## Índices Críticos (Performance)

```sql
-- Búsqueda rápida por username
CREATE INDEX idx_connections_pppoe 
ON connections(pppoe_username);

-- Búsqueda rápida de secretos
CREATE INDEX idx_ppp_secrets_name 
ON ppp_secrets(name);

-- Búsqueda de suscriptores
CREATE INDEX idx_subscribers_pppoe 
ON subscribers(pppoe_username);

-- Búsqueda por IP de router
CREATE INDEX idx_ppp_secrets_router_ip 
ON ppp_secrets(router_ip);

-- Búsqueda de clientes activos
CREATE INDEX idx_clientes_status 
ON clientes(status) WHERE status = 'active';
```

---

## Migraciones Históricas

Todas las migraciones se encuentran en `backend/alembic/versions/`.

### Versiones Importantes

| ID | Descripción | Fecha |
|----|-------------|-------|
| `221e88a56548` | Creación inicial de tablas | 2025-12-15 |
| `678033205aa3` | Post-stamp de sincronización | 2025-12-20 |

### Agregar una Nueva Migración

```bash
# 1. Modifica backend/src/models.py
# Ejemplo: agregar campo 'priority' a Subscriber

# 2. Generar la migración
docker-compose exec backend alembic revision --autogenerate \
  -m "agregar_priority_a_subscribers"

# 3. Revisar el archivo generado
cat backend/alembic/versions/xxxxx_agregar_priority_a_subscribers.py

# 4. Aplicar la migración
docker-compose exec backend alembic upgrade head
```

---

## Patrones de Consulta Común

### Buscar cliente por PPPoE username
```python
# SQL Puro
SELECT c.* FROM clientes c
JOIN connections conn ON c.id = conn.customer_id
WHERE conn.pppoe_username = 'juan_perez'

# SQLAlchemy
from src import models
from src.database import SessionLocal

db = SessionLocal()
cliente = db.query(models.Cliente)\
  .join(models.Connection)\
  .filter(models.Connection.pppoe_username == 'juan_perez')\
  .first()
```

### Obtener estado completo de una conexión
```python
def get_full_connection_status(pppoe_username: str):
    return {
        "cliente": db.query(models.Cliente)...,
        "conexion": db.query(models.Connection)...,
        "nodo": db.query(models.Node)...,
        "ppp_secret": db.query(models.PPPSecret)...,
        "subscriber": db.query(models.Subscriber)...,
    }
```

---

## Backup y Recovery

### Hacer backup de PostgreSQL
```bash
# Backup completo
docker-compose exec db pg_dump \
  -U ${POSTGRES_USER} ${POSTGRES_DB} > backup.sql

# Backup con compresión
docker-compose exec db pg_dump \
  -U ${POSTGRES_USER} -Fc ${POSTGRES_DB} > backup.dump
```

### Restaurar desde backup
```bash
# Desde archivo SQL
docker-compose exec -T db psql \
  -U ${POSTGRES_USER} ${POSTGRES_DB} < backup.sql

# Desde archivo comprimido
docker-compose exec -T db pg_restore \
  -U ${POSTGRES_USER} -d ${POSTGRES_DB} backup.dump
```

---

## Optimizaciones y Caché

### Datos que cambian frecuentemente
- **PPP Secrets** (estado de conexión) → Sin caché
- **ONU Signals** (señales ópticas) → Caché 5 minutos

### Datos que cambian raramente
- **Clientes** → Caché 24 horas
- **Planes** → Caché 24 horas
- **Nodos** → Caché 12 horas

### Implementar caché con Redis
```python
from src import config
import redis
import json

cache = redis.Redis(host='redis', port=6379, db=0)

def get_cliente_cached(cliente_id):
    key = f"cliente:{cliente_id}"
    cached = cache.get(key)
    if cached:
        return json.loads(cached)
    
    # Consultar BD
    cliente = db.query(models.Cliente).get(cliente_id)
    
    # Guardar en caché 24h
    cache.setex(key, 86400, json.dumps(cliente.to_dict()))
    return cliente
```

---

## Monitoreo de BD

### Conexiones activas
```bash
docker-compose exec db psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

### Tamaño de la BD
```bash
docker-compose exec db psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('emerald'));"
```

### Índices no utilizados
```bash
docker-compose exec db psql -U postgres -d emerald -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes 
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY tablename, indexname;"
```

