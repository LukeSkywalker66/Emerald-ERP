-- ============================================================================
-- FIX FINAL RJ45 (id = 18) → un solo tipo: BULK no compuesto, 98 unidades
-- ----------------------------------------------------------------------------
-- Diagnóstico:
--   - El producto YA es is_composite = false (unidades).
--   - Quedaron 88 unidades trazables huérfanas (bolsitas de 10) = 880 unidades.
--   - stock_bulk = 5 unidades.
--   - work_order_items = 0 y consumption_logs = 0 → se pueden borrar los seriales.
--
-- Objetivo: 1 producto, stock_bulk = 98, sin seriales.
--
-- DBeaver: autocommit OFF. Ejecutá las 2 sentencias juntas y COMMIT con el botón.
-- ============================================================================

-- 1) Eliminar las 88 unidades trazables huérfanas (bolsitas)
--    Efectos colaterales aceptados:
--      - stock_movements.serial_item_id  -> NULL (SET NULL)
--      - material_delivery_items.serial_item_id -> NULL (SET NULL)
DELETE FROM serial_items WHERE product_id = 18;

-- 2) Fijar el stock a granel en 98 unidades
UPDATE stock_bulk
SET quantity    = 98,
    updated_at  = NOW()
WHERE product_id = 18;

-- ============================================================================
-- Verificación (después del COMMIT)
-- ============================================================================
-- SELECT count(*) AS seriales_restantes FROM serial_items WHERE product_id = 18;  -- debe ser 0
-- SELECT sb.product_id, w.name AS deposito, sb.quantity
-- FROM stock_bulk sb JOIN warehouses w ON w.id = sb.warehouse_id
-- WHERE sb.product_id = 18;                                                      -- debe ser 98

-- ============================================================================
-- OPCIONAL (NO ejecutar salvo que quieras que el ledger de movimientos cierre
-- numéricamente en 98): el histórico suma 93 comprados (5 bulk + 88 x 1), así
-- que falta un ajuste de +5. Si preferís, usá tu herramienta de reconciliación
-- en lugar de este INSERT (queda mejor auditado desde la app).
-- ============================================================================
-- INSERT INTO stock_movements
--   (date, product_id, from_warehouse_id, to_warehouse_id, quantity, serial_item_id,
--    movement_type, reference, user_id, notes)
-- SELECT
--   NOW(), 18, NULL,
--   (SELECT id FROM warehouses WHERE name = 'Central Independencia' LIMIT 1),
--   5, NULL,
--   'ADJUSTMENT',
--   'Migración RJ45: consolidación a unidades (final 98)',
--   (SELECT user_id FROM stock_movements WHERE product_id = 18 ORDER BY id DESC LIMIT 1),
--   'Corrección de stock a 98 unidades';
