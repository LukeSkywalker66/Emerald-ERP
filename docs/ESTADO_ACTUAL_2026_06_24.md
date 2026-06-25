# Estado Actual del Proyecto - 24 Junio 2026

Sesion: Cierre de ciclo Q2 con foco en logistica, inventario trazable y hardening de cierre de OT.

## Resumen ejecutivo

| Componente | Estado | Detalle |
|---|---|---|
| Backend FastAPI | Estable | Endpoints de logistica, inventario y OT operativos |
| Frontend React/Vite | Estable | Wizard de cierre OT y vistas de inventario alineadas a trazabilidad |
| Base de Datos PostgreSQL | Estable | Consumo fraccionado auditable activo |
| Logistica de materiales | Estable | Escaneo, propuesta flexible, entregas/recepciones |
| Inventario compuesto trazable | Estable | Serial propio + saldo por unidad base |
| Versionado/entorno | Estable | Version visible en UI + endpoint system/version |

## Implementaciones clave desde 2026-06-02

### 1. Logistica y scanner
- Flujo de escaneo en entregas con soporte por codigo de barras y serial.
- Politica de propuesta flexible:
  - Si material queda fuera de propuesta aceptada, backend responde 409 OUTSIDE_ACCEPTED_PROPOSAL.
  - Frontend permite confirmacion operativa y retry con override explicito.
- Endpoint de etiquetas para unidades trazables:
  - GET /api/v2/tracked-units/labels

### 2. Inventario compuesto trazable
- Seriales propios para unidades compuestas (bobinas/blisters) con saldo en unidad base.
- Campos operativos usados por flujo:
  - serial_items.is_generated_barcode
  - serial_items.initial_quantity
  - serial_items.remaining_quantity
- Tabla de auditoria de consumo fraccionado:
  - consumption_logs (before/after por unidad trazable)

### 3. Cierre de OT con consumo fraccionado
- En cierre de OT, consumo de compuestos trazables descuenta metros/unidad base real.
- Se registran simultaneamente:
  - consumption_logs
  - stock_movements (movement_type=CONSUMPTION)
- El comportamiento de serializados no compuestos se mantiene sin regresion (instalacion completa).

### 4. Cierre forzado desde coordinacion (caso extraordinario)
- El wizard de cierre ya no depende solo del usuario logueado para resolver deposito.
- Si operador no tiene deposito propio, usa el deposito movil de la cuadrilla asignada a la OT (team_id).
- Esto aplica al flujo compartido del wizard (coordinacion y ejecucion tecnica).

### 5. UX de inventario
- StockTable mejorada:
  - iconos por categoria de producto,
  - expansion completa de seriales,
  - visibilidad de saldo por unidad trazable compuesta.
- Correccion de endpoint de stock por warehouse para metadata consistente en compuestos serializados.

### 6. Versionado y release hygiene
- Frontend:
  - version en UI tomada de package.json (1.0.0-rc.1),
  - favicon dinamico por entorno (development/staging/production).
- Backend:
  - FastAPI title/version actualizados,
  - endpoint autenticado de version:
    - GET /api/v2/system/version
    - respuesta: { version, environment }

## Estado operativo por modulo

### Tickets y WorkOrders
- Estable.
- Wizard de cierre robustecido en materiales y escenarios de coordinacion.

### Inventario
- Estable.
- Mejor trazabilidad de consumos de compuestos.

### Logistica
- Estable.
- Entregas/recepciones con escaneo operativo y control de propuesta flexible.

### Settings/System
- Estable.
- Endpoint de version y entorno disponible bajo autenticacion.

## Riesgos y deuda residual
- Warning de Vite por favicon en build local si no esta seteado VITE_APP_ENV en entorno de compilacion.
- Chunk size warning de frontend (deuda de code splitting, no bloqueante).

## Recomendaciones inmediatas
1. Mantener smoke tests de cierre OT (tecnico y coordinacion) como regresion obligatoria.
2. Agregar test automatizado de consumo fraccionado por serial compuesto (caso parcial, exacto, sobreconsumo).
3. Incorporar consulta operativa estandar para consumo por cliente/OT sobre consumption_logs.

## Referencias de implementacion (archivos)
- backend/src/services/wo_completion_service.py
- backend/src/routers/inventory.py
- backend/src/routers/logistics.py
- backend/src/routers/settings.py
- backend/src/schemas/logistics.py
- backend/src/schemas/settings.py
- backend/src/models/inventory.py
- frontend/src/components/work-orders/useMaterialSelector.js
- frontend/src/components/work-orders/MaterialSelectorForm.jsx
- frontend/src/components/inventory/StockTable.jsx
- frontend/src/hooks/useDeliveryScanner.jsx
- frontend/src/components/AppSidebar.jsx
- frontend/vite.config.js
- frontend/index.html
