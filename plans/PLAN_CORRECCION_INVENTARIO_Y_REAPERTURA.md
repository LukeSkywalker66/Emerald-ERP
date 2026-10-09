# Plan / Handoff — Corrección de inventario post-cierre y reapertura controlada de OT

> Documento de análisis y propuesta. **Estado: en análisis, no implementar aún.**
> Objetivo: retomar este tema sin volver a gastar en reconstruir contexto.

## 1. Contexto del problema

### 1.1 El incidente real (producción)

- Los técnicos **cierran OTs sin cargar los materiales consumidos**.
- Resultado: hay seriales (ej. **11 ONTs**) que figuran **"disponibles" en el móvil**
  cuando en realidad ya están **instalados en clientes**.
- Hoy la única salida es **rastrear manualmente por serial y corregir en DBeaver**
  (sin auditoría, riesgoso).
- Caso relacionado de **mala conexión**: el técnico cierra la OT y recién después
  puede corregir los materiales cuando recupera señal.

### 1.2 La tensión de diseño (planteada por el negocio)

- **Rigidez** → deja situaciones rotas (stock fantasma, seriales mal ubicados).
- **Edición libre de OT cerradas** → da lugar a manipulación descontrolada.
- Buscamos el punto medio: **corrección controlada y auditada**, no edición silenciosa.

## 2. Estado actual del sistema (referencias)

### 2.1 Inventario

| Concepto | Referencia |
|---|---|
| `SerialItem` (seriales y unidades trazables) | [`models/inventory.py`](../backend/src/models/inventory.py:432) |
| `SerialItemStatus` | [`models/inventory.py`](../backend/src/models/inventory.py:37) — `NEW`, `IN_VEHICLE`, `INSTALLED`, `DEFECTIVE`, `DAMAGED`, `DECOMMISSIONED`, `SOLD` |
| `StockBulk` (stock a granel por almacén) | [`models/inventory.py`](../backend/src/models/inventory.py:383) |
| `StockMovement` (auditoría de movimientos) | [`models/inventory.py`](../backend/src/models/inventory.py:523) |
| `MovementType` | [`models/inventory.py`](../backend/src/models/inventory.py:47) — `PURCHASE`, `TRANSFER`, `CONSUMPTION`, `RECOVERY`, `ADJUSTMENT`, `SALE`, `SALE_RETURN` |
| `ConsumptionLog` (consumo fraccionado) | [`models/inventory.py`](../backend/src/models/inventory.py:640) |
| `WarehouseType` | [`models/inventory.py`](../backend/src/models/inventory.py:23) — `CENTRAL`, `MOBILE`, `VIRTUAL`, `AUXILIAR` |

> Nota: los productos **compuestos** (cable, conectores, drop) se trackean como
> **unidades trazables** (`SerialItem` con `is_generated_barcode=true` y
> `remaining_quantity`), **no** como `StockBulk`. Ver [`barcode_generator_service.py`](../backend/src/services/barcode_generator_service.py:21).

### 2.2 Cierre de OT (efectos sobre inventario)

Endpoint: [`POST /work-orders/{id}/complete`](../backend/src/routers/work_orders.py:2035)
→ [`complete_work_order_with_inventory()`](../backend/src/services/wo_completion_service.py:57).

Al cerrar, cada `WorkOrderItem` se procesa así:

| Tipo de producto | Efecto | Referencia |
|---|---|---|
| BULK no compuesto | decrementa `StockBulk.quantity` en el móvil + `StockMovement(CONSUMPTION)` | [`_process_bulk_item`](../backend/src/services/wo_completion_service.py:276) |
| SERIALIZED | `SerialItem.status = INSTALLED`, lo mueve a warehouse `VIRTUAL`, setea `connection_id` y `ticket_related_id`, crea `ConnectionAsset` + `StockMovement(CONSUMPTION)` | [`_process_serialized_item`](../backend/src/services/wo_completion_service.py:347) |
| BULK compuesto (unidad trazable) | decrementa `remaining_quantity`, crea `ConsumptionLog`; si se agota → `INSTALLED` + mueve a virtual | [`_process_composite_tracked_serial_item`](../backend/src/services/wo_completion_service.py:426) |

**Consecuencia clave:** una reversa de cierre debe **deshacer** cada uno de esos
efectos (no basta con resetear el estado de la OT).

### 2.3 Reapertura de OT (ya existente, incompleta)

Endpoint: [`PUT /work-orders/{id}/reopen`](../backend/src/routers/work_orders.py:998).

Lo que hace hoy:
- Valida roles (admin/coordinator siempre; técnico asignado solo 2 h).
- Resetea `status = in_progress`, limpia `completed_at`, `resolution_type`,
  `resolution_notes`.
- Crea evento en timeline.

Lo que **NO** hace (gap):
- **No revierte el consumo de inventario** (no devuelve stock, no restaura seriales,
  no elimina `ConnectionAsset`).
- Tiene un **bug latente**: [`work_orders.py`](../backend/src/routers/work_orders.py:1050)
  usa `user_id` en vez de `current_user.id` para `is_assigned_technician` (solo
  estalla si no es admin).

### 2.4 Reapertura de tickets

Decidida en [`ADR-0001`](../docs/adr/ADR-0001-reapertura-tickets-y-rollback-instalacion.md:32):
botón "Reabrir" (PATCH status `open`), con timeline y auditoría. **No** reabre OTs
automáticamente.

### 2.5 Auditoría disponible

- [`audit_logs`](../backend/src/utils/audit.py): `log_create` / `log_update` / `log_delete`.
- `TicketTimeline` (eventos de ticket/OT).

## 3. Cómo lo manejan los sistemas carrier-class

Regla de oro: **los documentos contabilizados no se editan; se corrigen con
documentos de ajuste o reversa.**

1. **Reconciliación de inventario / stock adjustment:** para discrepancias físicas,
   se postea un movimiento de ajuste con **motivo obligatorio** y referencia al
   origen. La OT no se toca.
2. **Reversa de consumo (goods issue reversal):** si hay que corregir el consumo,
   se genera un movimiento inverso que revierte el efecto, dejando la OT original
   inmutable.
3. **Reopen controlado:** solo roles habilitados, con motivo y auditoría.

## 4. Parámetros que debe cumplir la solución

- **Trazabilidad total:** toda corrección queda en `audit_logs` + timeline.
- **Inmutabilidad del documento original:** no se edita una OT cerrada; se le
  agregan correcciones/reversas.
- **Roles acotados:** solo `admin`/`coordinator` para correcciones fuera de la
  ventana de gracia.
- **Motivo obligatorio** en toda corrección.
- **Operable sin SQL:** la corrección debe hacerse desde la UI.

## 5. Opciones analizadas

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| Editar OTs cerradas libremente | rápido | destruye trazabilidad, manipulación | **descartado** |
| Reconciliación de inventario (ajuste de serial/stock) | resuelve el caso actual sin tocar OT; auditado | no arregla la OT en sí (pero la OT ya está cerrada; solo se corrige stock) | **recomendado (P1)** |
| Reapertura de OT con reversión de inventario | cubre "mala conexión" (cerrar → corregir → re-cerrar) | complejo y riesgoso (revertir BULK, serial, ConnectionAsset, ConsumptionLog) | **recomendado (P2), con cuidado** |
| Reporte de discrepancias | detección temprana | no corrige | **recomendado (P3)** |

## 6. Propuesta detallada

### P1 — Reconciliación de inventario (desbloquea hoy)

Nueva acción en Inventario (admin/coordinator):

- Para un `SerialItem`: cambiar `status` y `warehouse_id`, y setear `connection_id`
  (ej. `NEW` → `INSTALLED` en la conexión correcta).
- Para `StockBulk`: ajustar `quantity` (con signo).
- **Motivo obligatorio** + referencia libre.
- Genera `StockMovement(ADJUSTMENT)` y `log_update` en auditoría.

Con esto se corrigen los 11 ONTs sin tocar OTs/tickets.

### P2 — Completar el `reopen` de OT con reversión de inventario

Al reabrir (roles ya definidos), además del reset de estado:

- **BULK:** devolver cantidad al `StockBulk` del móvil + movimiento de reversa.
- **SERIALIZED:** devolver `SerialItem` a `NEW`/`IN_VEHICLE`, restaurar warehouse
  original, limpiar `connection_id`/`ticket_related_id`, eliminar el `ConnectionAsset`
  + movimiento de reversa.
- **BULK compuesto (unidad trazable):** restaurar `remaining_quantity`, anular el
  `ConsumptionLog`, y revertir `INSTALLED`→ estado anterior si se había agotado.

Riesgos a mitigar: el `ConnectionAsset` puede estar referenciado en otros lados;
la reversa debe ser idempotente y transaccional.

### P3 — Reporte de discrepancias (detección temprana)

Reporte/query que detecte seriales que quedaron `NEW`/`IN_VEHICLE` en móviles
después de OTs cerradas (o seriales "disponibles" que ya deberían estar instalados).

## 7. Preguntas abiertas (para analizar)

1. ¿La reconciliación (P1) debe permitir también **crear** el vínculo a una
   conexión (instalar el serial), o solo corregir estado/ubicación?
2. ¿P2 (reopen con reversión) es realmente necesario, o alcanza con P1 + un flujo
   de "corregir materiales de OT cerrada" que postee ajustes sin reabrir?
3. ¿Qué pasa con el `ConnectionAsset` al revertir? (borrar vs marcar inactivo).
4. ¿Ventana de gracia para técnicos en P1, o solo admin/coordinator?
5. ¿Se necesita un "motivo" tipificado (enum) o alcanza texto libre?

## 8. Notas de contexto de sesiones previas (para no perder el hilo)

- Se agregó la regla **"una sola tarea en curso por cuadrilla"** al iniciar OT:
  [`work_orders.py`](../backend/src/routers/work_orders.py:736). Si una cuadrilla ya
  tiene una OT `in_progress`, no puede iniciar otra (409).
- Bugs de logística ya resueltos en esta misma iteración (AUXILIAR como origen de
  entrega, transferencia BULK compuesto, `product_type` vs `type`, etc.).
- El módulo de Ventas (acción de stock) ya está implementado: `SALE`/`SALE_RETURN`
  y `SerialItemStatus.SOLD`.
