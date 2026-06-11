# Plan: Fix 500 Error on Warehouse Creation + Add AUXILIAR Type

## Part 1: Root Cause — `_exclude_vehicle` scope bug

### Problem
In [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py), the helper function `_exclude_vehicle()` is defined as a **nested function** inside `list_warehouses()` (line 165), making it local to that function's scope. However, it's called from:

| Function | Line | Status |
|----------|------|--------|
| `list_warehouses()` ✅ | 172 | OK — same local scope |
| `create_warehouse()` ❌ | 220 | **`NameError`** → 500 |
| `update_warehouse()` ❌ | 315 | **`NameError`** → 500 |

When POSTing to `/api/v2/inventory/warehouses`, Python throws `NameError: name '_exclude_vehicle' is not defined`, FastAPI catches it and returns HTTP 500.

### Fix
Move `_exclude_vehicle` to **module level** (outside any function) in [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py):

```python
def _exclude_vehicle(d: dict) -> dict:
    """Excluir 'vehicle' del __dict__ del modelo ORM para evitar
    TypeError por duplicado con el kwarg explícito vehicle=..."""
    return {k: v for k, v in d.items() if k != 'vehicle'}
```

Remove the nested definition from inside `list_warehouses()`.

---

## Part 2: Add `AUXILIAR` Warehouse Type

### 2.1 Backend — Model Enum
**File:** [`backend/src/models/inventory.py`](backend/src/models/inventory.py:23)

Add `AUXILIAR = "AUXILIAR"` to `WarehouseType` enum:

```python
class WarehouseType(str, PyEnum):
    """Tipos de almacén/depósito."""
    CENTRAL = "CENTRAL"      # Depósito principal
    MOBILE = "MOBILE"        # Camioneta de técnico
    VIRTUAL = "VIRTUAL"      # Para bajas, perdidos, clientes
    AUXILIAR = "AUXILIAR"    # Depósito auxiliar/secundario
```

Add comment update for AUXILIAR.

Since `native_enum=False` is used (stores as VARCHAR), no DB migration is strictly needed — but a migration to update the column comment is recommended for documentation.

### 2.2 Backend — Router Validation
**File:** [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py)

Update validation logic in:
- `create_warehouse()` (line 200): Add `WarehouseType.AUXILIAR` to the list of types that **cannot** have `user_id`
- `update_warehouse()` (line 273): Same update for the edit path

```python
# Before:
if payload.type in [WarehouseType.CENTRAL, WarehouseType.VIRTUAL] and payload.user_id:
# After:
if payload.type in [WarehouseType.CENTRAL, WarehouseType.VIRTUAL, WarehouseType.AUXILIAR] and payload.user_id:
```

### 2.3 Backend — Logistics Router (no changes needed)
**File:** [`backend/src/routers/logistics.py`](backend/src/routers/logistics.py)

- Line 186: `wh_from.type != WarehouseType.CENTRAL` — OK, AUXILIAR is not CENTRAL
- Line 191: `wh_to.type != WarehouseType.MOBILE` — OK
These validations remain correct; AUXILIAR warehouses won't be valid origin/destination for the delivery flow.

### 2.4 Frontend — `WarehouseList.jsx`
**File:** [`frontend/src/pages/inventory/WarehouseList.jsx`](frontend/src/pages/inventory/WarehouseList.jsx)

| Line | Change |
|------|--------|
| 206-216 | Add `case 'AUXILIAR'` to `getTypeIcon()` — use `Archive` or `Layers` icon with amber/teal color |
| 219-225 | Add `AUXILIAR: 'bg-amber-900/30 text-amber-300 border-amber-800'` to type badge colors |
| 285 | Add `'AUXILIAR'` to filter buttons array |
| 347-350 | Add `AUXILIAR` to `warehousesByType` in `getInventoryStats()` |
| 457-464 | Add `AUXILIAR` count to stats footer — label: "auxiliares" |
| 521 | Already says "CENTRAL - Depósito principal" — keep as is |
| 522 | Add new option: `<option value="AUXILIAR">AUXILIAR - Depósito Auxiliar</option>` |
| 615 | Add same option in edit modal |

### 2.5 Frontend — `WarehouseDetail.jsx`
**File:** [`frontend/src/pages/inventory/WarehouseDetail.jsx`](frontend/src/pages/inventory/WarehouseDetail.jsx)

| Line | Change |
|------|--------|
| 104-112 | Add `case 'AUXILIAR'` to `getTypeIcon()` — match icon used in list |
| 116-126 | Add `case 'AUXILIAR'` to `getTypeColor()` — use `text-amber-400` |
| 168-174 | Add AUXILIAR badge styling (match list) |

### 2.6 Frontend — `InventoryDashboard.jsx`
**File:** [`frontend/src/pages/inventory/InventoryDashboard.jsx`](frontend/src/pages/inventory/InventoryDashboard.jsx)

| Line | Change |
|------|--------|
| 83 | Update detail text to include AUXILIAR count |
| 185-186 | Keep CENTRAL block |
| 201 | Add AUXILIAR block after VIRTUAL (new row) |

### 2.7 Frontend — `inventory.service.js`
**File:** [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js)

| Line | Change |
|------|--------|
| 347-350 | Add `AUXILIAR: warehouses.filter(w => w.type === 'AUXILIAR').length` |

### 2.8 Logistics Wizards (no changes needed)
**Files:**
- [`frontend/src/pages/logistics/MaterialReceiptWizard.jsx`](frontend/src/pages/logistics/MaterialReceiptWizard.jsx:34) — filters `w.type === 'CENTRAL'` for origin warehouse
- [`frontend/src/pages/logistics/MaterialDeliveryWizard.jsx`](frontend/src/pages/logistics/MaterialDeliveryWizard.jsx:104) — filters `w.type === 'CENTRAL'` for origin warehouse

These filters are correct — AUXILIAR warehouses should NOT appear as delivery origins (only CENTRAL provides materials). No changes needed.

---

## Implementation Order

### Step 1 — Fix the 500 error (Backend)
- Move `_exclude_vehicle` to module level in [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py)

### Step 2 — Add AUXILIAR enum (Backend)
- Add `AUXILIAR = "AUXILIAR"` to `WarehouseType` in [`backend/src/models/inventory.py`](backend/src/models/inventory.py)
- Update validation in [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py) `create_warehouse` and `update_warehouse`

### Step 3 — Update Frontend
- Update [`WarehouseList.jsx`](frontend/src/pages/inventory/WarehouseList.jsx): icon, badge, filter, form options, stats
- Update [`WarehouseDetail.jsx`](frontend/src/pages/inventory/WarehouseDetail.jsx): icon, color, badge
- Update [`InventoryDashboard.jsx`](frontend/src/pages/inventory/InventoryDashboard.jsx): breakdow row
- Update [`inventory.service.js`](frontend/src/services/inventory.service.js): add `warehousesByType.AUXILIAR`
