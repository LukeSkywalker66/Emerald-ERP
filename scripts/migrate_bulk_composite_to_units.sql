-- ============================================================================
-- Migración RJ45 (id = 18): BULK compuesto (bolsitas de 10) → BULK no compuesto (unidades)
-- Para DBeaver con autocommit DESACTIVADO (commit manual con el botón de arriba).
-- NO incluye BEGIN/COMMIT para no chocar con la transacción que ya abre DBeaver.
--
-- Cómo usarlo:
--   1. Si te quedó una transacción abierta, primero botón ROLLBACK.
--   2. Seleccioná las 3 sentencias de abajo y ejecutalas como script.
--   3. Verificá los resultados y, si está todo bien, botón COMMIT.
-- ============================================================================

-- 1) Consolidar bolsitas en stock_bulk, expresado en UNIDADES
--    (suma de remaining_quantity de cada bolsita)
INSERT INTO stock_bulk (warehouse_id, product_id, quantity, created_at, updated_at)
SELECT
    si.warehouse_id,
    si.product_id,
    SUM(COALESCE(si.remaining_quantity, si.initial_quantity, 0)),
    NOW(),
    NOW()
FROM serial_items si
WHERE si.product_id = 18
  AND si.warehouse_id IS NOT NULL
GROUP BY si.warehouse_id, si.product_id
ON CONFLICT (warehouse_id, product_id)
DO UPDATE
    SET quantity    = EXCLUDED.quantity,
        updated_at  = NOW();

-- 2) Eliminar las unidades compuestas (bolsitas)
DELETE FROM serial_items WHERE product_id = 18;

-- 3) Convertir el producto a BULK no compuesto (se consume por unidades)
UPDATE products
SET is_composite         = false,
    unit_size            = NULL,
    composite_unit_label = NULL
WHERE id = 18;

-- ============================================================================
-- Verificación (correr DESPUÉS del commit)
-- ============================================================================
-- SELECT id, sku, name, type, is_composite, unit_size, composite_unit_label, unit_measure
-- FROM products WHERE id = 18;
--
-- SELECT w.name AS deposito, sb.quantity
-- FROM stock_bulk sb JOIN warehouses w ON w.id = sb.warehouse_id
-- WHERE sb.product_id = 18;
--
-- SELECT count(*) AS seriales_restantes FROM serial_items WHERE product_id = 18;  -- debe ser 0

-- ============================================================================
-- OPCIONAL (NO ejecutar salvo que quieras que el histórico de movimientos se lea
-- en unidades en vez de bolsitas): multiplicar cantidades viejas por unit_size (10).
-- ============================================================================
-- UPDATE stock_movements
-- SET quantity = quantity * 10
-- WHERE product_id = 18
--   AND serial_item_id IS NULL
--   AND quantity IS NOT NULL;
