# Checklist de Pruebas — Corrección de Inventario y Reapertura Controlada de OT

> Versión: 2026-10-13 · Estado del código: F0–F7 + reversa real de materiales (P2).
> Antes de empezar, confirmar el despliegue:
> ```bash
> docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
> docker compose -f docker-compose.dev.yml restart backend
> docker compose -f docker-compose.dev.yml up -d --build frontend
> ```
> Cabeza esperada de Alembic: `2026_10_12_009`.

---

## 0. Precondiciones

- [ ] `alembic upgrade head` termina en `2026_10_12_009` sin errores.
- [ ] Abrir una OT cerrada **no** devuelve 500 (`GET /api/v2/work-orders/{id}`).
- [ ] `GET /api/v2/work-orders/updates/pending` responde 200 (no 500).

---

## 1. Flujo de materiales (§11) — depósito de origen correcto

- [ ] Cargar material en una OT desde la camioneta de una cuadrilla.
- [ ] Cerrar la OT: el descuento se hace del depósito de la cuadrilla (no del usuario que cierra).
- [ ] Cerrar con un coordinador/admin en nombre del técnico: descuenta del depósito correcto, no da "Stock insuficiente".
- [ ] Intentar cargar dos veces el mismo serial: se bloquea con mensaje claro.

---

## 2. Reconciliación de inventario (P1)

- [ ] Corregir un `SerialItem` (status/warehouse/connection) con motivo obligatorio → movimiento `ADJUSTMENT`.
- [ ] Corregir `StockBulk` con delta negativo → la cantidad no queda negativa.
- [ ] La corrección queda auditada (movimiento + motivo).

---

## 3. Bitácora post-cierre (P2) — ventana "mismo día"

- [ ] En una OT **en curso**, el panel de actualizaciones está deshabilitado (mensaje "Disponible al completar la OT").
- [ ] En una OT **completada o no realizada** el mismo día, el técnico puede registrar una actualización y queda `APPLIED`.
- [ ] Fuera de la ventana (o por otro usuario), la actualización queda `PROPOSED` y requiere aprobación.
- [ ] Un coordinador/admin puede aprobar (`APPROVED`) o rechazar (`REJECTED`) desde el listado de pendientes.
- [ ] Cada entrada genera evento de timeline y queda en la bitácora append-only.

---

## 4. Reversa REAL de materiales (P2) — los 3 casos del negocio

### 4.1 Cantidad mal cargada (drop 300 vs 30 metros)

- [ ] Cerrar una OT consumiendo 300 m de drop (bobina compuesta trazable).
- [ ] En bitácora → "Corregir cantidad" → elegir el item → cantidad correcta `30`.
- [ ] Verificar que el saldo de la bobina queda **restaurado a (saldo original − 30)**, no −300.
- [ ] El `ConsumptionLog` histórico suma 30 neto (reversa −300 + reproceso +30).

### 4.2 Serial de ONU equivocado

- [ ] Cerrar una OT instalando una ONU con serial **incorrecto** (S1).
- [ ] En bitácora → "Reemplazar material" → quitar S1 y agregar S2 (serial correcto).
- [ ] Verificar que S2 queda `INSTALLED` en la conexión y S1 vuelve a `IN_VEHICLE` (móvil).
- [ ] El `ConnectionAsset` de S1 queda `REMOVED` (no se borra).

### 4.3 Conectores verdes vs azules (BULK)

- [ ] Cerrar una OT consumiendo conectores verdes.
- [ ] Opción A: "Quitar material erróneo" (verdes) + "Agregar material olvidado" (azules).
- [ ] Opción B: "Reemplazar material" en una sola entrada.
- [ ] Verificar que el stock de verdes se reacredita y el de azules se descuenta.

---

## 5. Reporte de discrepancias (P4)

- [ ] El reporte detecta seriales "disponibles" que en realidad quedaron consumidos/instalados tras un cierre.
- [ ] La UI muestra las discrepancias y permite navegar a la corrección (reconciliación).

---

## 6. Cierre idempotente (§7)

- [ ] Reintentar el cierre de la misma OT con el mismo `idempotency_key` → no duplica consumo ni activos.
- [ ] Una OT cerrada sin materiales muestra el flag "cerrada sin materiales" en el timeline.

---

## 7. Instalación TV (F6)

- [ ] Crear ticket "Instalación TV": obliga a seleccionar conexión y usuario TV.
- [ ] El ticket genera automáticamente una OT de tipo neutro `install`.
- [ ] La OT `install` tiene acciones de resolución "Realizada" / "No Realizada" / "Configurar TV".
- [ ] `tv_accounts`: asignar una cuenta libre la marca "en uso"; liberarla la devuelve al pool.

---

## 8. Conexión física + swap blando (F7)

- [ ] Cerrar una OT de instalación/traslado usando la conexión física (`installation_connection_id`).
- [ ] Si la conexión ya tiene un activo `INSTALLED` del mismo producto, el cierre retira el anterior (`REMOVED` + devuelto al móvil) e instala el nuevo (swap blando).

---

## 9. Regresiones generales (por el cambio de esquema en `work_order_items`)

- [ ] Transferencia entre depósitos sigue funcionando (no toca `work_order_items`).
- [ ] Compra / alta de items en un depósito sigue funcionando.
- [ ] Detalle de OT muestra los materiales sin campos nuevos filtrados a la UI.
- [ ] Exploradores de productos / stock cargan sin error.
