-- ============================================================================
-- DIAGNÓSTICO COMPLETO RJ45 — foto de todos los flujos del/los producto/s RJ45
-- Correr en producción (DBeaver). Son solo SELECTs, no modifican nada.
-- ============================================================================

-- 1) Producto/s que matchean "rj45" (acá se ve si hay 1 o 2 registros)
SELECT id, sku, name, type, is_composite, unit_size, unit_measure,
       composite_unit_label, min_stock_alert, group_id, category
FROM products
WHERE name ILIKE '%rj45%' OR sku ILIKE '%rj45%'
ORDER BY id;

-- 2) Stock BULK (cantidad agregada) por producto y depósito
SELECT sb.product_id, p.sku, p.name, p.is_composite,
       w.name AS deposito, w.type AS tipo_deposito, sb.quantity
FROM stock_bulk sb
JOIN products p   ON p.id = sb.product_id
JOIN warehouses w ON w.id = sb.warehouse_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
ORDER BY p.id, w.name;

-- 3) Seriales / unidades compuestas por producto, depósito y estado
SELECT si.product_id, p.sku, p.name,
       w.name AS deposito, si.status,
       count(*) AS seriales,
       sum(COALESCE(si.remaining_quantity, si.initial_quantity, 0)) AS unidades_disponibles,
       sum(COALESCE(si.initial_quantity, 0))                       AS unidades_iniciales
FROM serial_items si
JOIN products p ON p.id = si.product_id
LEFT JOIN warehouses w ON w.id = si.warehouse_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY si.product_id, p.sku, p.name, w.name, si.status
ORDER BY si.product_id, w.name, si.status;

-- 4) Resumen de movimientos por producto y tipo de movimiento
SELECT m.product_id, p.sku, p.name, m.movement_type,
       count(*) AS movimientos,
       sum(COALESCE(m.quantity, 0)) AS cantidad_total
FROM stock_movements m
JOIN products p ON p.id = m.product_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY m.product_id, p.sku, p.name, m.movement_type
ORDER BY m.product_id, m.movement_type;

-- 5) Detalle de movimientos (histórico completo)
SELECT m.id, to_char(m.date, 'YYYY-MM-DD HH24:MI') AS fecha, m.product_id, p.sku,
       m.movement_type, m.quantity,
       wf.name AS desde, wt.name AS hacia, m.serial_item_id, m.reference, m.notes
FROM stock_movements m
JOIN products p ON p.id = m.product_id
LEFT JOIN warehouses wf ON wf.id = m.from_warehouse_id
LEFT JOIN warehouses wt ON wt.id = m.to_warehouse_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
ORDER BY m.id;

-- 6) Consumos en Órdenes de Trabajo
SELECT wi.product_id, p.sku, p.name,
       count(*) AS lineas_ot,
       sum(wi.quantity) AS cantidad_total_consumida
FROM work_order_items wi
JOIN products p ON p.id = wi.product_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY wi.product_id, p.sku, p.name;

-- 7) Entregas de materiales (líneas de entrega)
SELECT di.product_id, p.sku, p.name, di.is_serialized,
       count(*) AS lineas_entrega,
       sum(di.quantity_delivered) AS cantidad_entregada
FROM material_delivery_items di
JOIN products p ON p.id = di.product_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY di.product_id, p.sku, p.name, di.is_serialized;

-- 8) Recepciones de materiales (líneas de recepción)
SELECT ri.product_id, p.sku, p.name,
       count(*) AS lineas_recepcion,
       sum(ri.quantity) AS cantidad_recibida
FROM material_receipt_items ri
JOIN products p ON p.id = ri.product_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY ri.product_id, p.sku, p.name;

-- 9) Logs de consumo fraccionado (unidades compuestas consumidas)
SELECT si.product_id, p.sku, p.name,
       count(*) AS logs_consumo,
       sum(cl.quantity_consumed) AS unidades_consumidas
FROM consumption_logs cl
JOIN serial_items si ON si.id = cl.tracked_unit_id
JOIN products p      ON p.id = si.product_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
GROUP BY si.product_id, p.sku, p.name;

-- 10) Seriales puntuales del/los producto/s compuestos (por si hace falta revisarlos)
SELECT si.id, si.product_id, p.sku, si.serial_number,
       w.name AS deposito, si.status,
       si.initial_quantity, si.remaining_quantity, si.is_generated_barcode
FROM serial_items si
JOIN products p ON p.id = si.product_id
LEFT JOIN warehouses w ON w.id = si.warehouse_id
WHERE p.name ILIKE '%rj45%' OR p.sku ILIKE '%rj45%'
ORDER BY si.product_id, si.id;
