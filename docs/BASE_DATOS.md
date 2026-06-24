# Arquitectura de Base de Datos - Emerald ERP

Ultima actualizacion: 2026-06-24
Stack: PostgreSQL 15 + SQLAlchemy 2.0 + Alembic

---

## 1) Estado vigente

Modelo de datos estable, con foco operativo en:
- Tickets/OT
- Coordinacion/cuadrillas
- Flota/warehouses
- Inventario trazable
- Logistica de entregas/recepciones
- Auditoria

---

## 2) Novedades consolidadas (junio 2026)

### 2.1 Inventario compuesto trazable
Campos operativos en serial_items:
- is_generated_barcode
- initial_quantity
- remaining_quantity

### 2.2 Consumo fraccionado auditable
Entidad clave:
- consumption_logs

Atributos de auditoria relevantes:
- tracked_unit_id
- work_order_id
- quantity_consumed
- quantity_before
- quantity_after
- user_id
- warehouse_id
- created_at

### 2.3 Cierre OT con doble trazabilidad
Cada consumo impacta en:
- consumption_logs (historial fino)
- stock_movements (movimiento operativo)

### 2.4 Logistica de materiales
Bloque de tablas activas:
- material_deliveries
- material_delivery_items
- material_receipts
- material_receipt_items

---

## 3) Consultas recomendadas

Consumo por OT y unidad trazable:
```sql
SELECT
  cl.work_order_id,
  si.serial_number,
  cl.quantity_consumed,
  cl.quantity_before,
  cl.quantity_after,
  cl.created_at
FROM consumption_logs cl
JOIN serial_items si ON si.id = cl.tracked_unit_id
WHERE cl.work_order_id = :work_order_id
ORDER BY cl.created_at DESC;
```

Saldo actual por compuesto trazable:
```sql
SELECT
  si.id,
  si.serial_number,
  si.initial_quantity,
  si.remaining_quantity,
  p.name AS product_name,
  p.unit_measure
FROM serial_items si
JOIN products p ON p.id = si.product_id
WHERE p.is_composite = true
  AND si.is_generated_barcode = true;
```

---

## 4) Nota de contexto y legacy

El detalle historico extenso (diagramas ASCII grandes, fases antiguas, enumeraciones legacy) se mantiene fuera de primera plana en docs/_legacy/ para reducir ruido de contexto en asistentes.
