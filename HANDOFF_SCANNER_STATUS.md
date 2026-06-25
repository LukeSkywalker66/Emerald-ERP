# Handoff Arquitectónico — Módulo Barcode Reader Intelligence

**Fecha**: 2026-06-11  
**Contexto**: Implementación del módulo de inteligencia de lector de código de barras para los flujos de Compra (StockAdjustments) y Entrega de Material (MaterialDeliveryWizard).

---

## 1. Estado Actual — Archivos Modificados

### Backend (Python/FastAPI)

| Archivo | Tipo de cambio | Descripción |
|---------|---------------|-------------|
| [`backend/src/barcode_reader/__init__.py`](backend/src/barcode_reader/__init__.py) | **Nuevo** | Exporta `BarcodeScannerEngine`, `ScanType`, `Confidence`, `ScanContext`, `ScanResult` |
| [`backend/src/barcode_reader/protocols.py`](backend/src/barcode_reader/protocols.py) | **Nuevo** | Protocolo `BaseValidator` para validadores pluggables |
| [`backend/src/barcode_reader/schemas.py`](backend/src/barcode_reader/schemas.py) | **Nuevo** | Dataclasses: `ScanType` (PRODUCT_CODE, SERIAL_NUMBER, MAC_ADDRESS, UNKNOWN), `Confidence`, `ScanContext`, `ScanResult` |
| [`backend/src/barcode_reader/patterns.py`](backend/src/barcode_reader/patterns.py) | **Nuevo** | `SerialPatternRegistry` — obtiene regex de `Product.serial_validation_regex` desde DB + fallback ITU-T G.984 |
| [`backend/src/barcode_reader/validators.py`](backend/src/barcode_reader/validators.py) | **Nuevo** | 5 validadores: `ProductCodeValidator`, `SerialFormatValidator`, `ITUTG984Validator`, `MacAddressFilter` (4 patrones MAC autocontenidos), `GenericSerialValidator` |
| [`backend/src/barcode_reader/core.py`](backend/src/barcode_reader/core.py) | **Nuevo** | `BarcodeScannerEngine` — orquestador con `identify()` que ejecuta validadores en orden de prioridad |
| [`backend/src/models/inventory.py`](backend/src/models/inventory.py) | **Modificado** | Agregados: modelo `SerialFormat` (línea 586), modelo `PurchaseScanSession` (línea 641), columna `Product.serial_validation_regex` (línea 301) |
| [`backend/src/schemas/inventory.py`](backend/src/schemas/inventory.py) | **Modificado** | Agregados: `serial_validation_regex` en `ProductBase`/`ProductUpdate`/`ProductResponse`; schemas de scan (`ScanCodeRequest/Response`, `ScanSerialRequest/Response`, `ScanSessionResponse`, `ScanSessionConfirmResponse`) |
| [`backend/src/schemas/logistics.py`](backend/src/schemas/logistics.py) | **Modificado** | Agregados a `MaterialDeliveryItemResponse`: `serial_validation_regex: Optional[str]`, `product_type: Optional[str]` (línea 45-46) |
| [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py) | **Modificado** | Nuevos endpoints: `POST /stock/scan`, `POST /stock/scan-serial`, `GET /stock/scan-session/{id}`, `DELETE ...`, `POST .../confirm`, `GET /resolve-scan` |
| [`backend/src/routers/logistics.py`](backend/src/routers/logistics.py) | **Modificado** | `_delivery_to_response` ahora popula `serial_validation_regex` y `product_type` desde el join con `Product`. Endpoints `scan_barcode`, `scan_serial`, `scan_receipt_item` refactorizados para usar `BarcodeScannerEngine`. |
| [`backend/alembic/versions/2026_06_09_001_add_serial_formats_and_scan_sessions.py`](backend/alembic/versions/2026_06_09_001_add_serial_formats_and_scan_sessions.py) | **Nuevo** | Migración: tablas `serial_formats`, `purchase_scan_sessions` |
| [`backend/alembic/versions/2026_06_10_002_add_serial_validation_regex.py`](backend/alembic/versions/2026_06_10_002_add_serial_validation_regex.py) | **Nuevo** | Migración: columna `serial_validation_regex` en `products` |

### Frontend (React/JavaScript)

| Archivo | Tipo de cambio | Descripción |
|---------|---------------|-------------|
| [`frontend/src/components/barcode-reader/useBarcodeScan.js`](frontend/src/components/barcode-reader/useBarcodeScan.js) | **Nuevo** | Hook de buffer de teclado para scanner gun: acumula caracteres, detecta Enter, timeout 30ms entre chars |
| [`frontend/src/components/barcode-reader/BarcodeScanner.jsx`](frontend/src/components/barcode-reader/BarcodeScanner.jsx) | **Nuevo** | Componente reusable de input de escaneo con `useBarcodeScan` interno |
| [`frontend/src/components/barcode-reader/SerialScanner.jsx`](frontend/src/components/barcode-reader/SerialScanner.jsx) | **Nuevo** | Componente para escaneo de seriales con `useBarcodeScan` interno + botón cancelar |
| [`frontend/src/components/barcode-reader/ScanCounter.jsx`](frontend/src/components/barcode-reader/ScanCounter.jsx) | **Nuevo** | Contador visual con barra de progreso |
| [`frontend/src/components/barcode-reader/ScannedSerialsList.jsx`](frontend/src/components/barcode-reader/ScannedSerialsList.jsx) | **Nuevo** | Lista de seriales escaneados con botón remove |
| [`frontend/src/components/barcode-reader/index.js`](frontend/src/components/barcode-reader/index.js) | **Nuevo** | Barrel export del módulo |
| [`frontend/src/hooks/useBarcodeScanner.jsx`](frontend/src/hooks/useBarcodeScanner.jsx) | **Nuevo** | Hook legacy de listener de teclado global (usado por `RegexTester.jsx`) |
| [`frontend/src/hooks/useDeliveryScanner.jsx`](frontend/src/hooks/useDeliveryScanner.jsx) | **Nuevo** | Máquina de estados IDLE/WAITING_SERIAL para el wizard de entrega — clasificador local + delegación a API |
| [`frontend/src/components/inventory/RegexTester.jsx`](frontend/src/components/inventory/RegexTester.jsx) | **Nuevo** | Componente visual cyberpunk para probar regex de validación de seriales |
| [`frontend/src/pages/inventory/StockAdjustments.jsx`](frontend/src/pages/inventory/StockAdjustments.jsx) | **Modificado** | Integrado con `BarcodeScannerEngine` vía API; botón único "Registrar Compra"; botón Cancelar; fix de fecha en movimientos |
| [`frontend/src/pages/inventory/ProductCatalog.jsx`](frontend/src/pages/inventory/ProductCatalog.jsx) | **Modificado** | Campo `serial_validation_regex` en create/edit de productos; `RegexTester` visible para productos SERIALIZED |
| [`frontend/src/pages/logistics/MaterialDeliveryWizard.jsx`](frontend/src/pages/logistics/MaterialDeliveryWizard.jsx) | **Modificado** | Step 3 integrado con `useDeliveryScanner` hook; `BarcodeScanner` deshabilitado durante `WAITING_SERIAL`; contadores "(X of Y)" por producto |
| [`frontend/src/services/inventory.service.js`](frontend/src/services/inventory.service.js) | **Modificado** | Agregados: `scanCode()`, `scanSerial()`, `getScanSession()`, `removeSerialFromSession()`, `confirmScanSession()` |
| [`frontend/src/services/logistics.service.js`](frontend/src/services/logistics.service.js) | **Modificado** | Endpoints de scan refactorizados para usar nueva API |

---

## 2. Funcionalidad Rota / Regresión — Conflicto de Listeners de Teclado

### Síntoma
Al integrar `SerialScanner` en el Step 3 del `MaterialDeliveryWizard`, el lector de código de barras dejaba de funcionar después de la primera lectura. El listener de teclado global se bloqueaba.

### Causa Raíz
**Dos instancias de `useBarcodeScan` compitiendo por el mismo evento `keydown` en `window`.**

```
BarcodeScanner (siempre renderizado)
  └── useBarcodeScan → window.addEventListener('keydown', ...)  ← Listener A

SerialScanner (renderizado condicionalmente en WAITING_SERIAL)
  └── useBarcodeScan → window.addEventListener('keydown', ...)  ← Listener B
```

Cuando el scanner gun disparaba un Enter:
1. **Listener A** capturaba → llamaba `onScan(code)` → `deliveryScanner.resolveScan(code)`
2. **Listener B** también capturaba → llamaba `onScan(code)` → `deliveryScanner.resolveScan(code)` (bloqueado por `isProcessing`)
3. Ambos listeners reseteaban sus buffers internos, causando pérdida de caracteres en lecturas subsiguientes

### Mitigación Aplicada
En [`MaterialDeliveryWizard.jsx`](frontend/src/pages/logistics/MaterialDeliveryWizard.jsx:668), el `BarcodeScanner` se deshabilita cuando `scanMode === 'WAITING_SERIAL'`:
```jsx
disabled={scanComplete || deliveryScanner.scanMode === 'WAITING_SERIAL'}
```
Esto evita que `useBarcodeScan` dentro de `BarcodeScanner` registre su listener durante el modo de escaneo de seriales. Solo UN `useBarcodeScan` está activo a la vez.

### Problema Residual
Esta solución es un **workaround**, no una solución arquitectónica. El problema de fondo es que `useBarcodeScan` registra un listener global en `window` en lugar de estar ligado al ciclo de vida de un input específico. Si en el futuro se agregan más componentes con `useBarcodeScan`, el conflicto resurgirá.

---

## 3. Estructura del Backend

### Nuevo Endpoint: `GET /api/v2/inventory/resolve-scan`

**Ubicación**: [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py:1771)

**Propósito**: Resolución ciega de códigos escaneados. No requiere `delivery_id`. Usado por el frontend como fallback cuando la clasificación local (SKU/regex) no puede identificar el código.

**Flujo**:
```
1. Recibe ?query= (string)
2. Convierte a uppercase
3. Verifica si es MAC address (usa _is_mac_address del barcode_reader)
   → Sí: retorna {"type": "mac", "message": "..."}
4. Busca por SKU en Product.sku
   → Encontrado: retorna {"type": "product", "product": {...}}
5. Busca por serial_number en SerialItem
   → Encontrado y status=NEW: retorna {"type": "serial", "serial": {...}, "product": {...}}
   → Encontrado pero status≠NEW: HTTP 400
6. No encontrado: HTTP 404
```

**Respuesta `type: "product"`**:
```json
{
  "type": "product",
  "product": {
    "id": int,
    "name": str,
    "sku": str,
    "is_serialized": bool,
    "serial_validation_regex": str|null
  }
}
```

**Respuesta `type: "serial"`**:
```json
{
  "type": "serial",
  "serial": {
    "id": int,
    "serial_number": str,
    "product_id": int,
    "warehouse_id": int,
    "status": str
  },
  "product": {
    "id": int,
    "name": str
  }
}
```

**Respuesta `type: "mac"`**:
```json
{
  "type": "mac",
  "message": "Dirección MAC detectada — ignorada"
}
```

### Schemas Pydantic Modificados en `logistics.py`

**`MaterialDeliveryItemResponse`** — dos campos nuevos:

| Campo | Tipo | Origen |
|-------|------|--------|
| `serial_validation_regex` | `Optional[str]` | `item.product.serial_validation_regex` (join con Product) |
| `product_type` | `Optional[str]` | `item.product.type.value` (SERIALIZED, BULK, etc.) |

Estos campos se popula en [`_delivery_to_response()`](backend/src/routers/logistics.py:81) cuando se construye la respuesta de cualquier endpoint que retorne `MaterialDeliveryResponse` (get_delivery, generate_proposal, confirm_delivery).

### Motor Barcode Reader (backend)

```
BarcodeScannerEngine.identify(code, context)
  │
  ├── MacAddressFilter (priority 5)    → ScanType.MAC_ADDRESS
  ├── ProductCodeValidator (priority 10) → ScanType.PRODUCT_CODE
  ├── SerialFormatValidator (priority 20) → ScanType.SERIAL_NUMBER (usa Product.serial_validation_regex)
  ├── ITUTG984Validator (priority 25)    → ScanType.SERIAL_NUMBER (fallback ITU-T G.984)
  └── GenericSerialValidator (priority 30) → ScanType.SERIAL_NUMBER (fallback genérico)
```

---

## 4. Pendiente — Máquina de Estados Estricta

### Objetivo Final
El `useDeliveryScanner` hook debe implementar una **máquina de estados estricta** gobernada exclusivamente por el **estado de la promesa de Axios** (`isProcessing` ref flag), sin:

- ❌ **Debounce artificial** — el scanner gun ya emite Enter al finalizar; cualquier timeout agrega latencia innecesaria
- ❌ **Hardcodeo de strings MAC** en el frontend — la detección de MAC debe delegarse al backend (`/resolve-scan` o `BarcodeScannerEngine`)
- ❌ **Pre-filtros que bloquean códigos desconocidos** — el hook debe clasificar lo que pueda localmente y delegar el resto al API

### Estado Actual del Hook `useDeliveryScanner`

**Archivo**: [`frontend/src/hooks/useDeliveryScanner.jsx`](frontend/src/hooks/useDeliveryScanner.jsx)

**Estados**: `IDLE` | `WAITING_SERIAL`

**Reglas implementadas**:
1. ✅ Bloqueo por `isProcessing` ref (promise guard) — impide llamadas concurrentes a `resolveScan`
2. ✅ Clasificación local por SKU y `serial_validation_regex` de la propuesta — sin hardcodear MAC
3. ✅ Delegación a API `/resolve-scan` para códigos no clasificables localmente
4. ✅ Dedup de seriales (por `serial_item_id` desde API)
5. ✅ Audio feedback (Web Audio API beeps)
6. ✅ Auto-dismiss de feedback a los 4 segundos

**Flujo actual**:
```
resolveScan(code)
  │
  ├─ isProcessing? → return (bloqueo)
  ├─ classifyLocal(code, proposalItems)
  │   ├─ SKU match → producto serializado? → WAITING_SERIAL : agregar directo
  │   └─ Regex match → WAITING_SERIAL? validar producto : agregar directo
  │
  └─ API /resolve-scan (si no clasificó localmente)
      ├─ type=mac → beep error, ignorar
      ├─ type=product → serializado? → WAITING_SERIAL : agregar
      └─ type=serial → validar/dedup → agregar
```

### Lo que Falta Implementar
- [ ] **TrackedUnits + Generador de códigos de barra** (diseñado en [`plans/PLAN_TRACKED_UNITS_BARCODE_GENERATOR.md`](plans/PLAN_TRACKED_UNITS_BARCODE_GENERATOR.md))
- [ ] **Refactor de Compras a Módulo de Logística** (diseñado en [`plans/PLAN_REFACTOR_COMPRAS_A_LOGISTICA.md`](plans/PLAN_REFACTOR_COMPRAS_A_LOGISTICA.md))
- [ ] **Solución arquitectónica al conflicto de listeners** — `useBarcodeScan` debería ser un singleton o usar un context provider para evitar múltiples listeners en `window`

---

## Referencia Rápida de Archivos Clave

| Propósito | Archivo |
|-----------|---------|
| Motor barcode reader (backend) | [`backend/src/barcode_reader/core.py`](backend/src/barcode_reader/core.py) |
| Validadores pluggables | [`backend/src/barcode_reader/validators.py`](backend/src/barcode_reader/validators.py) |
| Endpoint resolve-scan | [`backend/src/routers/inventory.py`](backend/src/routers/inventory.py:1771) |
| Response schema logistics | [`backend/src/schemas/logistics.py`](backend/src/schemas/logistics.py:28) |
| Delivery response builder | [`backend/src/routers/logistics.py`](backend/src/routers/logistics.py:63) |
| Hook máquina de estados | [`frontend/src/hooks/useDeliveryScanner.jsx`](frontend/src/hooks/useDeliveryScanner.jsx) |
| Componente scanner input | [`frontend/src/components/barcode-reader/BarcodeScanner.jsx`](frontend/src/components/barcode-reader/BarcodeScanner.jsx) |
| Componente serial input | [`frontend/src/components/barcode-reader/SerialScanner.jsx`](frontend/src/components/barcode-reader/SerialScanner.jsx) |
| Keyboard buffer hook | [`frontend/src/components/barcode-reader/useBarcodeScan.js`](frontend/src/components/barcode-reader/useBarcodeScan.js) |
| Wizard de entrega | [`frontend/src/pages/logistics/MaterialDeliveryWizard.jsx`](frontend/src/pages/logistics/MaterialDeliveryWizard.jsx) |
| Página de compras | [`frontend/src/pages/inventory/StockAdjustments.jsx`](frontend/src/pages/inventory/StockAdjustments.jsx) |
| Catálogo de productos | [`frontend/src/pages/inventory/ProductCatalog.jsx`](frontend/src/pages/inventory/ProductCatalog.jsx) |
| Regex tester visual | [`frontend/src/components/inventory/RegexTester.jsx`](frontend/src/components/inventory/RegexTester.jsx) |
| Plan original del módulo | [`plans/PLAN_BARCODE_READER_MODULE.md`](plans/PLAN_BARCODE_READER_MODULE.md) |
