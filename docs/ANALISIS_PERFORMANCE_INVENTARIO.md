# ⚡ Análisis de Performance — Módulo de Inventario / Logística

**Fecha:** 2026-05-19  
**Analista:** Roo (AI Agent)  
**Módulo:** [`frontend/src/pages/inventory/InventoryDashboard.jsx`](frontend/src/pages/inventory/InventoryDashboard.jsx)  
**Servicio Frontend:** [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js)  
**Router Backend:** [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py)  
**Modelos:** [`backend/src/models/inventory.py`](backend/src/models/inventory.py)

---

## 🔴 Diagnóstico: Causa Raíz de Lentitud

La lentitud del dashboard de inventario **NO es culpa de la base de datos** (tablas pequeñas, todos los índices necesarios existen). El problema es un **patrón N+1 masivo en el FRONTEND** que genera decenas de llamadas HTTP innecesarias por cada carga del dashboard.

### ¿Qué sucede cuando cargás el dashboard?

[`InventoryDashboard.jsx:26`](frontend/src/pages/inventory/InventoryDashboard.jsx:26) ejecuta `loadDashboardData()` que lanza dos funciones en paralelo:

```javascript
const [statsData, alertsData] = await Promise.all([
  getInventoryStats(),   // ← 3 llamadas HTTP
  getStockAlerts()       // ← 2 + (N × M) llamadas HTTP
]);
```

---

## 📊 Desglose de llamadas HTTP por carga

### 1. `getInventoryStats()` — [`inventory.service.js:330`](frontend/src/services/inventory.service.js:330)

```javascript
const [warehouses, products, movements] = await Promise.all([
  getWarehouses(),                    // 1  → GET /api/v2/inventory/warehouses
  getProducts(),                      // 1  → GET /api/v2/inventory/products
  getMovements({ limit: 10 })        // 1  → GET /api/v2/inventory/movements?limit=10
]);
```

**Total: 3 llamadas HTTP**

Estas son razonables (pueden ir en paralelo), pero luego se **duplican** en el paso siguiente.

### 2. `getStockAlerts()` — [`inventory.service.js:275`](frontend/src/services/inventory.service.js:275)

```javascript
const products = await getProducts();                 // 1 → ¡DUPLICADO! Ya se llamó arriba
const warehouses = await getWarehouses();              // 1 → ¡DUPLICADO! Ya se llamó arriba

for (const product of products) {                      // ← N productos
  for (const warehouse of warehouses) {                //   ← M warehouses
    const warehouseStock = await getWarehouseStock(warehouse.id);  // N × M llamadas
    // ...calcula stock total por producto...
  }
}
```

**Total: 2 + (N × M) llamadas HTTP**

Donde:
- **N** = cantidad de productos en catálogo
- **M** = cantidad de warehouses

**Escenario típico:** Si hay 10 productos y 7 warehouses → **72 llamadas HTTP solo para `getStockAlerts()`**

### 🔢 Cálculo Total por Dashboard Load

| Función | Llamadas | Detalle |
|---------|----------|---------|
| `getInventoryStats()` | 3 | warehouses + products + movements |
| `getStockAlerts()` | 2 + (N × M) | products + warehouses + stock por cada combinación |
| **TOTAL** | **5 + (N × M)** | Ej: 10 prod × 7 wh = **75 llamadas** |

Cada llamada es un **round-trip HTTP completo**: resolución DNS → conexión TCP → request → procesamiento backend → serialización → response → parse JSON. Si cada una toma ~50-200ms, 75 llamadas secuenciales son **3.7 a 15 segundos**.

---

## 🔍 Problemas Secundarios

### A) Backend N+1 en [`get_warehouse_stock`](backend/src/routers/inventory.py:419)

```python
for product_id, serials in serials_by_product.items():
    prod_obj = db.get(Product, product_id)  # ← N+1: 1 query extra por producto
```

Los `SerialItem` ya tienen `product` cargado via `joinedload(SerialItem.product)` en la línea 375. Pero igual se hace un `db.get(Product)` extra solo para obtener `category`. Se puede reemplazar con `serials[0].product.category`.

### B) Duplicación de llamadas [`getProducts()` / `getWarehouses()`](frontend/src/services/inventory.service.js:277-281)

`getStockAlerts()` y `getInventoryStats()` llaman a los mismos endpoints por separado. No hay caché ni memoización. Si el dashboard tarda, se descarta todo y se reintenta desde cero.

### C) [`getMyWarehouse()`](frontend/src/services/inventory.service.js:43-54) filtra client-side

```javascript
const warehouses = await getWarehouses({ type: 'MOBILE', warehouse_type: 'MOBILE' });
return warehouses.find((warehouse) => warehouse.user_id === userId) || null;
```

El backend ya acepta `user_id` como filtro (`list_warehouses` en [`inventory.py:55`](backend/src/routers/inventory.py:55)), pero el frontend pasa dos params equivalentes (`type` y `warehouse_type`) y filtra client-side.

### D) Validaciones con `SELECT *` en vez de `SELECT COUNT(*)`

Tanto [`delete_warehouse`](backend/src/routers/inventory.py:268-314) como [`delete_product`](backend/src/routers/inventory.py:622-664) cargan TODAS las filas con `.scalars().all()` solo para verificar existencia:

```python
# inventory.py:269-276 — Carga TODAS las filas de StockBulk en memoria
bulk_count = db.execute(
    select(StockBulk).where(...)
).scalars().all()
# Solo usa len(bulk_count) para el mensaje de error
```

Deberían usar `select(func.count()).where(...)` o al menos `.first()`.

---

## 📈 Base de Datos: Estado Actual

| Tabla | Filas estimadas | Tamaño | Índices |
|-------|----------------|--------|---------|
| `warehouses` | 0 | 56 KB | 3 (type, user_id, pk) |
| `products` | 1 | 96 KB | 5 (sku, type, category, pk, sku_key) |
| `stock_bulk` | 0 | 72 KB | 4 (product_id, warehouse_id, pk, unique_composite) |
| `serial_items` | 0 | 112 KB | 6 (product_id, serial_number, status, warehouse_id, pk, serial_key) |
| `stock_movements` | 0 | 128 KB | 7 (date, from_wh, movement_type, product_id, to_wh, user_id, pk) |

**Total: 25 índices — todos correctos y funcionales.** No hay cuellos de botella visibles en la BD con los volúmenes actuales.

### Índices compuestos potencialmente útiles (futuro crecimiento):

- `stock_movements(product_id, from_warehouse_id)` — para consultas que filtran por producto + warehouse origen
- `stock_movements(product_id, to_warehouse_id)` — para consultas que filtran por producto + warehouse destino
- `serial_items(warehouse_id, status)` — para la consulta de stock por warehouse que filtra por `status IN (NEW, USED)`

---

## ✅ Recomendaciones de Optimización

### 🔴 PRIORIDAD 1 (Impacto Inmediato): Endpoint Dedicado para Alertas de Stock

**Problema:** `getStockAlerts()` hace N×M llamadas HTTP (una por combinación producto×warehouse).

**Solución:** Crear un endpoint backend `GET /api/v2/inventory/stock/alerts` que:
1. Haga una sola consulta SQL que JOINee `products` + `stock_bulk` + `serial_items`
2. Calcule `SUM(quantity)` por producto (BULK) + `COUNT(serial_items)` por producto (SERIALIZED)
3. Compare contra `products.min_stock_alert`
4. Devuelva directamente el array de alertas

```python
# Pseudocódigo del nuevo endpoint
@router.get("/stock/alerts")
def get_stock_alerts(db: Session = Depends(get_db)):
    # Una sola consulta con LEFT JOIN y agregación
    stmt = (
        select(
            Product.id,
            Product.name,
            Product.sku,
            Product.min_stock_alert,
            func.coalesce(func.sum(StockBulk.quantity), 0).label("total_bulk"),
            func.count(SerialItem.id).label("total_serialized")
        )
        .outerjoin(StockBulk, StockBulk.product_id == Product.id)
        .outerjoin(SerialItem, and_(
            SerialItem.product_id == Product.id,
            SerialItem.status.in_([SerialItemStatus.NEW, SerialItemStatus.USED])
        ))
        .group_by(Product.id)
        .having(
            func.coalesce(func.sum(StockBulk.quantity), 0) +
            func.count(SerialItem.id) < Product.min_stock_alert
        )
    )
    ...
```

**Reducción de llamadas:** 72 → 1 (99% menos)

### 🔴 PRIORIDAD 2 (Casi Inmediato): Combinar `getInventoryStats` + `getStockAlerts`

**Problema:** Ambos llaman a `getProducts()` y `getWarehouses()` por separado.

**Solución A (Backend):** Crear endpoint `GET /api/v2/inventory/dashboard` que devuelva stats + alerts en una sola respuesta.

**Solución B (Frontend, más rápida de implementar):** Cachear las promesas de `getProducts()` y `getWarehouses()` con memoización simple:

```javascript
// Promise caching — evita duplicar llamadas en el mismo tick
let productsPromiseCache = null;
export const getProducts = async (filters = {}) => {
  const cacheKey = JSON.stringify(filters);
  if (!productsPromiseCache) {
    productsPromiseCache = api.get(`${BASE_URL}/products`, { params: filters })
      .then(res => res.data || []);
  }
  return productsPromiseCache;
};
```

### 🟡 PRIORIDAD 3: Fix N+1 en Backend `get_warehouse_stock`

En [`inventory.py:419`](backend/src/routers/inventory.py:419), reemplazar:

```python
# ANTES: query N+1
prod_obj = db.get(Product, product_id)
category = prod_obj.category if prod_obj else None

# DESPUÉS: usar la relación ya cargada
category = serials[0].product.category if serials else None
```

### 🟡 PRIORIDAD 4: SELECT COUNT(*) en Lugar de SELECT *

En [`delete_warehouse`](backend/src/routers/inventory.py:268-314) y [`delete_product`](backend/src/routers/inventory.py:622-664):

```python
# ANTES: carga todas las filas
bulk_count = db.execute(select(StockBulk).where(...)).scalars().all()

# DESPUÉS: solo cuenta
from sqlalchemy import func
bulk_count = db.execute(
    select(func.count()).select_from(StockBulk).where(...)
).scalar()
```

### 🟢 PRIORIDAD 5 (Opcional): Fix `getMyWarehouse`

En [`inventory.service.js:48`](frontend/src/services/inventory.service.js:48):

```javascript
// ANTES: pasa dos params equivalentes y filtra client-side
const warehouses = await getWarehouses({ type: 'MOBILE', warehouse_type: 'MOBILE' });
return warehouses.find((warehouse) => warehouse.user_id === userId) || null;

// DESPUÉS: usa el filtro user_id del backend
const [warehouse] = await getWarehouses({ type: 'MOBILE', user_id: userId });
return warehouse || null;
```

---

## 🎯 Resumen del Impacto Esperado

| Optimización | Reducción de llamadas | Impacto percibido |
|-------------|----------------------|-------------------|
| Endpoint `GET /stock/alerts` | 72 → 1 por carga | ⚡ Extremo |
| Cacheo de promesas duplicadas | Elimina 2 llamadas redundantes | 🟢 Moderado |
| Fix N+1 backend | 1 query menos por producto serializado | 🟢 Leve |
| SELECT COUNT(*) | Menos carga en BD | 🟢 Leve |
| Fix getMyWarehouse | 0 (solo correctitud) | 🟢 Cosmético |

**Con todas las optimizaciones:** De **75 llamadas HTTP** por carga del dashboard a **~3-4 llamadas**. Tiempo de carga estimado: de **3-15 segundos a <500ms**.

---

## 🔗 Referencias

- [`inventory.service.js:275-324`](frontend/src/services/inventory.service.js:275) — `getStockAlerts()` (causa principal del N+1)
- [`inventory.service.js:330-357`](frontend/src/services/inventory.service.js:330) — `getInventoryStats()` (duplica llamadas)
- [`inventory.service.js:43-54`](frontend/src/services/inventory.service.js:43) — `getMyWarehouse()` (filtro client-side)
- [`inventory.py:419`](backend/src/routers/inventory.py:419) — N+1 `db.get(Product)` en backend
- [`inventory.py:268-314`](backend/src/routers/inventory.py:268) — `SELECT *` en delete validations
- [`InventoryDashboard.jsx:31-33`](frontend/src/pages/inventory/InventoryDashboard.jsx:31) — Punto de entrada del dashboard
