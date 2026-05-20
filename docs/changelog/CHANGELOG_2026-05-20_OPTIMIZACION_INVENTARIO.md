# 🚀 Changelog: Optimización de Rendimiento — Módulo Inventario/Logística

**Fecha:** 20 Mayo 2026  
**Commit:** [`fafe458`](..) (rama `refactor/api-routing-standards`)  
**Restore Point:** `restorepoint-2026-05-19-inventario-optimizaciones`  

---

## 🔍 Diagnóstico Inicial

Se identificaron **5 hallazgos críticos** de performance en el módulo de inventario:

| # | Problema | Impacto Estimado | Prioridad |
|---|---------|-----------------|-----------|
| 1 | **N+1 masivo** en `getStockAlerts()` — N productos × M warehouses = N×M requests HTTP por dashboard load | 🔴 Crítico | P0 |
| 2 | **N+1 backend** en `get_warehouse_stock` — `db.get(Product, id)` dentro del loop de seriales, ignorando `joinedload` | 🟡 Medio | P1 |
| 3 | **SELECT *** en validaciones de delete — Carga todas las filas en memoria para contar (`.scalars().all()`) | 🟢 Bajo | P2 |
| 4 | **Llamadas HTTP duplicadas** — `getInventoryStats()` + `getStockAlerts()` llaman `getProducts()`/`getWarehouses()` sin compartir cache | 🟡 Medio | P1 |
| 5 | **Filtrado client-side** — `getMyWarehouse()` usa `.find()` en vez del filtro `user_id` del backend | 🟢 Bajo | P2 |

---

## 🛠️ Cambios Realizados

### Backend (Python/FastAPI)

#### 1. Nuevo Endpoint: `GET /api/v2/inventory/stock/alerts`

**Archivo:** [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py:56)

Reemplaza el N+1 masivo del frontend con **una sola consulta SQL**:

```sql
SELECT p.id, p.name, p.sku, p.type, p.category, p.min_stock_alert,
       COALESCE(SUM(sb.quantity), 0) AS total_bulk,
       COUNT(si.id) AS total_serialized
FROM products p
LEFT JOIN stock_bulk sb ON sb.product_id = p.id AND sb.quantity > 0
LEFT JOIN serial_items si ON si.product_id = p.id
    AND si.status IN ('NEW', 'USED')
GROUP BY p.id, p.name, p.sku, p.type, p.category, p.min_stock_alert
HAVING COALESCE(SUM(sb.quantity), 0) + COUNT(si.id) < p.min_stock_alert
ORDER BY p.name;
```

**Antes:** `getProducts()` + `getWarehouses()` + N×M llamadas a `getWarehouseStock(warehouse.id)`  
**Después:** 1 request HTTP → 1 query SQL → N resultados

#### 2. Fix N+1 en `get_warehouse_stock`

**Archivo:** [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py:480)

```python
# ANTES: db.get(Product, product_id) por cada serial item (N+1)
product = db.get(Product, product_id)
category = product.category if product else None

# DESPUÉS: Mapa precargado desde joinedload
product_category_map = {}
for item in serial_items:
    if item.product_id not in product_category_map and item.product:
        product_category_map[item.product_id] = item.product.category
category = product_category_map.get(product_id)
```

#### 3. Fix SELECT * → SELECT COUNT(*) en delete validations

**Archivo:** [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py:335)

```python
# ANTES: Carga todas las filas en memoria
bulk_items = db.execute(
    select(StockBulk).where(StockBulk.warehouse_id == warehouse_id, StockBulk.quantity > 0)
).scalars().all()
if len(bulk_items) > 0: ...

# DESPUÉS: Solo cuenta en DB
bulk_count = db.execute(
    select(func.count()).select_from(StockBulk).where(...)
).scalar()
if bulk_count and bulk_count > 0: ...
```

Aplicado en:
- `delete_warehouse` (3 validaciones: bulk, seriales, movimientos)
- `delete_product` (3 validaciones: bulk, seriales, movimientos)

#### 4. Nuevo Schema Pydantic

**Archivo:** [`backend/src/schemas/inventory.py`](backend/src/schemas/inventory.py)

```python
class StockAlertItem(BaseModel):
    product_id: int
    product_name: str
    product_sku: str
    product_type: ProductType
    category: Optional[str] = None
    total_stock: float
    min_stock_alert: int
    deficit: float
    model_config = ConfigDict(from_attributes=True)
```

---

### Frontend (React/JS)

#### 1. Refactor `getStockAlerts()`

**Archivo:** [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js:305)

```javascript
// ANTES: N×M requests HTTP
const products = await getProducts();
const warehouses = await getWarehouses();
for (const product of products) {
    for (const warehouse of warehouses) {
        const stock = await getWarehouseStock(warehouse.id);
        // ...find product in stock...
    }
}

// DESPUÉS: 1 request HTTP
const { data } = await api.get(`${BASE_URL}/stock/alerts`);
return data || [];
```

#### 2. Promise Caching

**Archivo:** [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js:19)

```javascript
let _warehousesPromiseCache = null;
let _productsPromiseCache = null;

export const getWarehouses = async (filters = {}) => {
    const noFilters = Object.keys(filters).length === 0;
    if (noFilters && _warehousesPromiseCache) return _warehousesPromiseCache;
    const promise = api.get(...).then(res => res.data || []);
    if (noFilters) _warehousesPromiseCache = promise;
    return promise;
};
```

#### 3. Fix `getMyWarehouse()` — Server-side filtering

**Archivo:** [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js:64)

```javascript
// ANTES: Filtra client-side con .find()
const warehouses = await getWarehouses({ type: 'MOBILE', warehouse_type: 'MOBILE' });
return warehouses.find(w => w.user_id === userId) || null;

// DESPUÉS: Usa filtro user_id del backend
const { data } = await api.get(`${BASE_URL}/warehouses`, {
    params: { warehouse_type: 'MOBILE', user_id: userId }
});
return data?.[0] || null;
```

#### 4. InventoryDashboard adaptado

**Archivo:** [`frontend/src/pages/inventory/InventoryDashboard.jsx`](frontend/src/pages/inventory/InventoryDashboard.jsx:227)

```javascript
// ANTES: alert.product.name, alert.totalStock, alert.minStock
// DESPUÉS: alert.product_name, alert.total_stock, alert.min_stock_alert
```

---

## 📊 Impacto en Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Requests HTTP al cargar dashboard | N×M + N + M + 10 | N + M + 10 + 1 | **~98% menos** |
| Queries SQL en backend (stock alerts) | N×M | 1 | **~99% menos** |
| Filas cargadas en delete validations | Todas | 0 (solo count) | **100% optimizado** |
| Llamadas duplicadas en stats+alerts | 4 | 2 (compartidas) | **50% menos** |

Donde N = cantidad de productos (~10-50), M = cantidad de warehouses (~5-20)

---

## 🔄 Cómo Revertir

```bash
git checkout restorepoint-2026-05-19-inventario-optimizaciones
docker compose restart backend
```

---

## 📋 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/src/schemas/inventory.py` | + `StockAlertItem` schema |
| `backend/src/routers/inventory.py` | + endpoint, fix N+1, fix SELECT * |
| `frontend/src/services/inventory.service.js` | Refactor, promise caching, fix filtering |
| `frontend/src/pages/inventory/InventoryDashboard.jsx` | Nuevo response shape |
| `docs/ANALISIS_PERFORMANCE_INVENTARIO.md` | Análisis completo (nuevo) |
