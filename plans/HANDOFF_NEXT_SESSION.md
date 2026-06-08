# Hand-off: Próxima Sesión — Refactor Unidades Compuestas

## Estado Actual

Se implementó el módulo de Logística y Productos V2 en el entorno **dev** (`emerald-dev.2finternet.ar`). Funciona pero hay un error conceptual que requiere refactor.

## Problema Conceptual

**Stock almacenado en unidad base (metros) en vez de unidad comprable (bobinas).**

Ejemplo: "Bobina de drop 300m"
- Al comprar 1 bobina → se guarda como 300m en StockBulk
- Debería guardarse como 1 (bobina) en StockBulk
- El depósito debe mostrar "10 bobinas", no "3000m"
- Solo en el móvil se debe desglosar: "1 bobina (300m disponibles)"

## Arquitectura Actual (incorrecta)

```
StockBulk.quantity = almacena en metros para productos compuestos
Compra: cantidad × unit_size → metros
StockAlerts: compara metros contra min_stock_alert
Transferencias: transfiere metros
```

## Arquitectura Deseada (correcta)

```
StockBulk.quantity = almacena en unidades comprables (bobinas, blisters)
Compra: cantidad = bobinas (sin multiplicar)
Depósito CENTRAL: muestra "10 bobinas"
Depósito MOBILE: muestra "1 bobina (300m)" con desglose usando unit_size
Consumo en OT: el técnico descuenta en metros desde el móvil
StockAlerts: compara bobinas contra min_stock_alert
```

## Archivos Modificados (para referencia)

### Backend — Nuevos
- `backend/src/models/logistics.py` — MaterialDelivery, MaterialDeliveryItem, MaterialReceipt, MaterialReceiptItem
- `backend/src/schemas/logistics.py` — Schemas de delivery/receipt/scan/proposal
- `backend/src/services/material_delivery_service.py` — Propuesta inteligente, confirmación
- `backend/src/services/inventory_service.py` — Helpers transfer_stock_bulk, transfer_stock_serial
- `backend/src/routers/logistics.py` — 22 endpoints de logística

### Backend — Modificados
- `backend/src/models/inventory.py` — ProductGroup, ProductSpec, campos compuestos en Product
- `backend/src/schemas/inventory.py` — Schemas de grupos, specs, producto ampliado
- `backend/src/routers/inventory.py` — CRUD groups, specs, product response con relaciones
- `backend/src/models/work_order_types.py` — WOTemplateItem.group_id
- `backend/src/schemas/work_order_types.py` — WOTemplateItemCreate/Response con group_id
- `backend/src/routers/work_order_types.py` — Fix: group_id no se guardaba en templates

### Frontend — Nuevos
- `frontend/src/services/logistics.service.js` — Cliente API logística
- `frontend/src/pages/logistics/MaterialDeliveryDashboard.jsx` — Dashboard con toggle
- `frontend/src/pages/logistics/MaterialDeliveryWizard.jsx` — Wizard 4 pasos
- `frontend/src/pages/logistics/MaterialReceiptWizard.jsx` — Wizard recepción 3 pasos

### Frontend — Modificados
- `frontend/src/pages/settings/ProductGroupsTab.jsx` — CRUD de grupos de producto
- `frontend/src/pages/settings/WOTemplatesTab.jsx` — Soporte de grupos en plantillas
- `frontend/src/pages/inventory/ProductCatalog.jsx` — Formulario con grupos, specs, compuestos
- `frontend/src/pages/inventory/StockAdjustments.jsx` — Conversión compuestos (parcial)
- `frontend/src/services/inventory.service.js` — Funciones groups + specs
- `frontend/src/App.jsx` — 5 rutas de logística
- `frontend/src/components/AppSidebar.jsx` — Menú "Entregas a Cuadrillas"
- `frontend/src/pages/SettingsPage.jsx` — Pestaña "Grupos de Producto"

### Migraciones (ejecutadas en dev DB)
- `2026_06_08_001` — product_groups table
- `2026_06_08_002` — composite fields + product_specs
- `2026_06_08_003` — logistics tables
- `2026_06_08_004` — group_id en wo_template_items

## Bugs Conocidos

1. **Stock en base units** — El refactor principal pendiente
2. **StockAdjustments** — La compra multiplica por unit_size (workaround), debería guardar directo
3. **Validación escaneo por cantidad** — Hoy valida 1 producto = 1 escaneo, debería validar cantidades exactas

## Decisions Técnicas

- `emerald_backend_dev` es el contenedor de desarrollo
- `emerald_nginx_dev` es el nginx de desarrollo
- No tocar producción (`/opt/emerald-erp/`) ni staging
- Cada entorno tiene su branch y docker-compose
- El proxy global `emerald_global_proxy` rutea subdominios

## Para la Próxima Sesión

1. Revisar `plans/REFACTOR_UNIDADES_COMPUESTAS.md` con el plan detallado
2. Migración de datos: convertir stock existente de metros a bobinas
3. Modificar StockAdjustments para comprar en unidades compuestas
4. Modificar vistas de depósito para mostrar en bobinas
5. Modificar alertas para comparar en bobinas
6. Agregar desglose en depósito móvil
7. Modificar consumo en OT para descontar en metros desde el móvil
