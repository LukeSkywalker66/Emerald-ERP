# 🔧 CONTEXTO TÉCNICO SESIÓN NEXT - Nightly Sync + Migraciones BD + Coordinación

## 📍 OBJETIVO
Conectar módulo Coordinación (frontend WorkOrder) con sincronización nocturna (ISPCube/Mikrotik) vía migraciones de BD que expandan `work_orders` con campos nuevos.

---

## 📂 ARCHIVOS CRÍTICOS A LEER (ORDEN)

### TIER 1: Modelos + Migraciones Existentes
```
backend/src/models/
  ├─ work_order.py          ← Modelo actual WorkOrder
  ├─ synchronization.py     ← (probablemente vacío o legado)
  └─ ticket.py              ← Referencia para event-based pattern

backend/alembic/versions/
  ├─ (últimas 3-5 migraciones) ← Ver patrón de cambios
  └─ env.py                 ← Config autosync
```

**Leer:**
- `backend/src/models/work_order.py` → Campos actuales (id, type, status, etc.)
- `backend/src/models/ticket.py` → Cómo se estructura event_data (JSONB)
- Última migración en `backend/alembic/versions/` → Patrón de cambios

---

### TIER 2: Sync + Integraciones Externas
```
backend/src/jobs/sync.py
  ├─ sync_clientes()        ← Cómo obtiene clientes ISPCube
  ├─ sync_connections()     ← Cómo obtiene conexiones
  └─ nightly_sync_task()    ← Orquestación principal

backend/src/clients/
  ├─ ispcube.py             ← API ISPCube (clientes, conexiones)
  ├─ mikrotik.py            ← RouterOS API (PPP secrets, estadísticas)
  └─ smartolt.py            ← SmartOLT API (ONUs)

backend/src/models/
  ├─ customer.py            ← Tabla customers (ISPCube source)
  ├─ connection.py           ← Tabla connections (ISPCube source)
  ├─ ppp_secret.py          ← Tabla ppp_secrets (Mikrotik source)
  └─ subscriber.py          ← Tabla subscribers (SmartOLT source)
```

**Leer:**
- `backend/src/jobs/sync.py` COMPLETO → Entender flujo datos
- `backend/src/clients/ispcube.py` → Estructura API calls
- `backend/src/clients/mikrotik.py` → Stats y estado conexiones
- `backend/src/models/customer.py` + `connection.py` → Estructura datos origen

---

### TIER 3: Frontend Coordinación (Context)
```
frontend/src/components/coordination/
  ├─ DraggableWorkOrderCard.jsx   ← Card actual (Tactical HUD)
  ├─ CoordinationGrid.jsx          ← Grid/layout container
  └─ (otros componentes)           ← Context providers

frontend/src/hooks/
  └─ useWorkOrders.ts             ← Fetch actual + caching
```

**Leer:**
- `frontend/src/hooks/useWorkOrders.ts` → Qué datos espera del backend
- `frontend/src/components/coordination/DraggableWorkOrderCard.jsx` → Qué campos renderiza
- Ver endpoint actual: `GET /v2/work-orders/coordination/grid` en backend

---

### TIER 4: API Backend Actual
```
backend/src/routes/v2/
  └─ work_orders.py         ← Endpoints actuales
    ├─ GET /v2/work-orders/coordination/grid
    ├─ POST /v2/work-orders/{id}
    └─ ...otros
```

**Leer:**
- Buscar endpoint `/coordination/grid` → Qué query hace
- Buscar query builder actual → Joins, fields, filtering

---

## 🎯 CAMBIOS NECESARIOS (ORDEN DE EJECUCIÓN)

### PASO 1: MIGRACIÓN BD (alembic)
**Archivos:**
- `backend/alembic/versions/XXXX_add_work_order_external_fields.py` (NEW)

**Cambios:**
```python
# Agregar a work_orders table:
- external_id (String)           # ID de ISPCube (ticket_id)
- customer_id (Integer, FK)      # Link a customers table
- connection_id (Integer, FK)    # Link a connections table  
- ppp_secret_id (Integer, FK)    # Link a ppp_secrets (Mikrotik)
- subscriber_id (Integer, FK)    # Link a subscribers (SmartOLT)
- sync_status (String)           # "synced"|"pending"|"failed"
- last_synced_at (DateTime)      # Timestamp última sincronización
- external_data (JSONB)          # Cache de datos ISPCube/Mikrotik
  ├─ ispcube_cliente
  ├─ ispcube_conexion
  ├─ mikrotik_stats (velocity, ip, mac, last_seen)
  ├─ smartolt_onu (state, signal, velocity)
  └─ errors (array de últimos errores)
```

---

### PASO 2: ACTUALIZAR MODELO (work_order.py)
**Archivo:** `backend/src/models/work_order.py`

**Cambios:**
```python
# Agregar Mapped[] fields:
from sqlalchemy.orm import Mapped, mapped_column, relationship

class WorkOrder(Base):
    # Existentes...
    
    # NUEVOS:
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"))
    connection_id: Mapped[Optional[int]] = mapped_column(ForeignKey("connections.id"))
    ppp_secret_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ppp_secrets.id"))
    subscriber_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subscribers.id"))
    
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    external_data: Mapped[dict] = mapped_column(JSONB, default={})
    
    # Relationships:
    customer: Mapped[Optional["Customer"]] = relationship("Customer")
    connection: Mapped[Optional["Connection"]] = relationship("Connection")
    ppp_secret: Mapped[Optional["PPPSecret"]] = relationship("PPPSecret")
    subscriber: Mapped[Optional["Subscriber"]] = relationship("Subscriber")
```

---

### PASO 3: SERVICIO WorkOrderSyncService (NEW)
**Archivo:** `backend/src/services/work_order_sync_service.py` (NEW)

**Responsabilidades:**
```python
class WorkOrderSyncService:
    """Sincroniza WorkOrders con datos externos (ISPCube, Mikrotik, SmartOLT)"""
    
    async def match_work_order_to_customer(wo: WorkOrder, ppp_username: str):
        """Busca customer en BD por username PPPoE"""
        # Query ppp_secrets → ppp_username
        # Link a customers vía connection
        # Actualiza wo.customer_id, wo.connection_id, wo.ppp_secret_id
    
    async def enrich_work_order_external_data(wo: WorkOrder):
        """Obtiene datos actuales de ISPCube/Mikrotik/SmartOLT"""
        # Llamar ispcube.get_client(customer_id)
        # Llamar mikrotik.get_secret_stats(ppp_secret)
        # Llamar smartolt.get_onu(onu_id)
        # Guardar en wo.external_data (JSONB)
    
    async def sync_all_pending_work_orders():
        """Celery task: sincroniza todos los WorkOrders sin sync_status='synced'"""
        # Llamar nightly_sync_task desde sync.py
        # Luego iterar WorkOrders pending
        # Para cada uno:
        #   - match_work_order_to_customer()
        #   - enrich_work_order_external_data()
        #   - Actualizar sync_status='synced'
```

---

### PASO 4: ACTUALIZAR nightly_sync_task() (sync.py)
**Archivo:** `backend/src/jobs/sync.py`

**Cambios:**
```python
# En nightly_sync_task(), agregar paso al final:

async def nightly_sync_task(self):
    # ... (pasos 1-6 existentes)
    
    # PASO 7 (NUEVO): Sincronizar WorkOrders
    await sync_work_orders(db)

async def sync_work_orders(db):
    """Sincroniza todos los WorkOrders con datos externos"""
    from src.services.work_order_sync_service import WorkOrderSyncService
    
    # Query todos WorkOrders con status != 'completed'
    pending_wos = db.query(WorkOrder).filter(
        WorkOrder.sync_status.in_(["pending", "failed"])
    ).all()
    
    for wo in pending_wos:
        try:
            # Buscar customer por ppp_username (si existe)
            await WorkOrderSyncService.match_work_order_to_customer(wo)
            
            # Enriquecer con datos externos
            await WorkOrderSyncService.enrich_work_order_external_data(wo)
            
            # Marcar como sincronizado
            wo.sync_status = "synced"
            wo.last_synced_at = datetime.utcnow()
            
        except Exception as e:
            logger.warning(f"⚠️ WO {wo.id} sync failed: {e}")
            wo.sync_status = "failed"
            wo.external_data["errors"] = [str(e)]
    
    db.commit()
```

---

### PASO 5: ACTUALIZAR ENDPOINT /coordination/grid
**Archivo:** `backend/src/routes/v2/work_orders.py`

**Cambios:**
```python
# En endpoint GET /v2/work-orders/coordination/grid:

@router.get("/coordination/grid")
async def get_coordination_grid(db: Session = Depends(get_db)):
    """Retorna WorkOrders con datos enriquecidos para coordinación"""
    
    wos = db.query(
        WorkOrder.id,
        WorkOrder.type,
        WorkOrder.status,
        WorkOrder.priority,
        WorkOrder.created_at,
        WorkOrder.updated_at,
        # NUEVOS:
        WorkOrder.external_id,
        WorkOrder.sync_status,
        Customer.name.label("customer_name"),
        Customer.address.label("customer_address"),
        Connection.plan_id,
        Plan.name.label("plan_name"),
        WorkOrder.external_data,
    ).outerjoin(Customer).outerjoin(Connection).join(Plan).filter(
        WorkOrder.status != "completed"
    ).all()
    
    return [{
        "id": wo.id,
        "type": wo.type,
        "status": wo.status,
        "priority": wo.priority,
        "created_at": wo.created_at,
        # NUEVOS CAMPOS:
        "customer": {
            "name": wo.customer_name,
            "address": wo.customer_address,
        },
        "connection": {
            "plan": wo.plan_name,
        },
        "sync_status": wo.sync_status,
        "external_data": wo.external_data or {},
    } for wo in wos]
```

---

### PASO 6: ACTUALIZAR Frontend (useWorkOrders.ts)
**Archivo:** `frontend/src/hooks/useWorkOrders.ts`

**Cambios:**
```typescript
// Agregar tipos / interfaces:

interface WorkOrderExtendedData {
  id: string;
  type: "install" | "repair" | "removal" | "infra";
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "normal" | "high" | "critical";
  created_at: string;
  
  // NUEVOS:
  customer?: {
    name: string;
    address: string;
  };
  connection?: {
    plan: string;
  };
  sync_status: "pending" | "synced" | "failed";
  external_data?: {
    ispcube_cliente?: Record<string, any>;
    ispcube_conexion?: Record<string, any>;
    mikrotik_stats?: Record<string, any>;
    smartolt_onu?: Record<string, any>;
    errors?: string[];
  };
}

// En hook:
export const useWorkOrders = () => {
  const [orders, setOrders] = useState<WorkOrderExtendedData[]>([]);
  
  useEffect(() => {
    const fetchOrders = async () => {
      const response = await apiClient.get("/v2/work-orders/coordination/grid");
      setOrders(response.data);
    };
    
    fetchOrders();
  }, []);
  
  return { orders };
};
```

---

### PASO 7: ACTUALIZAR DraggableWorkOrderCard
**Archivo:** `frontend/src/components/coordination/DraggableWorkOrderCard.jsx`

**Cambios:**
```javascript
// En el tooltip, agregar sección de status sincronización:

// ANTES:
const tooltipContent = (
  <div className="...">
    <div>{card.customer_name || "Sin cliente"}</div>
    <div>{card.customer_address || "Sin dirección"}</div>
    ...
  </div>
);

// DESPUÉS (agregar):
<div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-700">
  <Badge variant={
    card.sync_status === 'synced' ? 'success' :
    card.sync_status === 'failed' ? 'destructive' :
    'secondary'
  }>
    {card.sync_status === 'synced' ? '✓ Sincronizado' :
     card.sync_status === 'failed' ? '✗ Error sync' :
     '⏳ Pendiente'}
  </Badge>
  {card.external_data?.errors?.map(err => (
    <span className="text-xs text-ruby-400">{err}</span>
  ))}
</div>

// Mostrar velocidad Mikrotik si existe:
{card.external_data?.mikrotik_stats?.velocity && (
  <div className="text-xs text-emerald-400">
    🚀 {card.external_data.mikrotik_stats.velocity} Mbps
  </div>
)}
```

---

## 📊 ESTRUCTURA DATOS (JSONB en work_orders.external_data)

```json
{
  "ispcube_cliente": {
    "id": "CLIE-001",
    "name": "Juan García",
    "email": "juan@example.com",
    "phone": "+54 11 1234-5678",
    "address": "Calle 123, Apt 4B",
    "city": "Buenos Aires",
    "status": "activo"
  },
  "ispcube_conexion": {
    "id": "CONE-001",
    "ppp_username": "juan_garcia",
    "plan_id": "PLAN-50",
    "plan_name": "Plan 50 Mb",
    "created_date": "2024-06-15",
    "status": "activa"
  },
  "mikrotik_stats": {
    "secret_name": "juan_garcia",
    "disabled": false,
    "profile": "PLAN-50",
    "ip": "192.168.100.45",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "last_seen": "2026-02-09T10:34:22Z",
    "velocity": 47.3,
    "service": "pppoe"
  },
  "smartolt_onu": {
    "onu_id": "00:11:22:33:44:55",
    "status": "online",
    "signal_strength": -18,
    "velocity_down": 48.5,
    "velocity_up": 9.8,
    "last_sync": "2026-02-09T03:00:00Z"
  },
  "errors": [
    "Conexión Mikrotik timeout (2026-02-08 02:55)",
    "SmartOLT ONU not found (2026-02-07)"
  ]
}
```

---

## 🔄 FLUJO DATOS END-TO-END

```
1. NIGHTLY SYNC (3:00 AM)
   nightly_sync_task() → sync_work_orders()

2. MATCH WORK ORDERS A CUSTOMERS
   For each WorkOrder (sin customer_id):
     - Si tiene ppp_username → buscar en ppp_secrets
     - Si ppp_secret existe → buscar connection vía PPP secret
     - Si connection existe → obtener customer_id
     - Update wo.customer_id, wo.connection_id, wo.ppp_secret_id

3. ENRICH EXTERNAL DATA
   For each WorkOrder (matched):
     - ispcube.get_client(customer_id) → external_data.ispcube_cliente
     - ispcube.get_connection(connection_id) → external_data.ispcube_conexion
     - mikrotik.get_secret_stats(ppp_secret_id) → external_data.mikrotik_stats
     - smartolt.get_onu(onu_id) → external_data.smartolt_onu

4. FRONTEND FETCH
   useWorkOrders() → GET /v2/work-orders/coordination/grid

5. RENDER
   DraggableWorkOrderCard:
     - Mostrar customer name + address (desde external_data)
     - Mostrar sync_status con badge
     - Mostrar velocidad Mikrotik (si existe)
     - Mostrar errores (si existen)
```

---

## 🛠 ARCHIVOS A CREAR/MODIFICAR (CHECKLIST)

```
CREAR:
[ ] backend/src/services/work_order_sync_service.py
[ ] backend/alembic/versions/XXXX_add_work_order_external_fields.py (migration)

MODIFICAR:
[ ] backend/src/models/work_order.py (agregar fields)
[ ] backend/src/jobs/sync.py (agregar sync_work_orders + paso en nightly_sync_task)
[ ] backend/src/routes/v2/work_orders.py (update endpoint /coordination/grid)
[ ] frontend/src/hooks/useWorkOrders.ts (agregar tipos, update fetch)
[ ] frontend/src/components/coordination/DraggableWorkOrderCard.jsx (mostrar sync_status + datos)

VALIDAR:
[ ] requirements.txt → sqlalchemy >= 2.0
[ ] docker-compose.yml → Redis running
[ ] backend/alembic/env.py → autogenerate=True
```

---

## 📍 REFERENCIA RÁPIDA (COMANDOS)

```bash
# Generar migración automática
cd backend && alembic revision --autogenerate -m "add_work_order_external_fields"

# Ejecutar migraciones
docker compose exec backend alembic upgrade head

# Ver esquema actual
docker compose exec db psql -U emerald -d emerald_db -c "\d work_orders"

# Ejecutar sync manual
docker compose exec backend python -c \
  "from src.jobs.sync import nightly_sync_task; nightly_sync_task()"

# Ver logs sync
docker compose logs -f celery_worker | grep "work_orders\|sync"
```

---

## 🎯 PUNTOS DE VALIDACIÓN

1. **Migración:** ¿Se ejecuta sin errores?
   ```bash
   docker compose exec backend alembic upgrade head
   ```

2. **Sync:** ¿Enriquece work_orders.external_data?
   ```sql
   SELECT id, external_data, sync_status FROM work_orders LIMIT 1;
   ```

3. **API:** ¿Retorna datos enriquecidos?
   ```bash
   curl http://localhost:8000/v2/work-orders/coordination/grid | jq
   ```

4. **Frontend:** ¿Renderiza sin errores?
   ```bash
   npm run dev  # En frontend/
   # Verificar console por errores
   ```

---

**Última actualización:** 9 de febrero de 2026  
**Para:** Sesión next (nightly_sync + migraciones + coordinación)  
**Formato:** Machine-readable (optimizado para Copilot)
