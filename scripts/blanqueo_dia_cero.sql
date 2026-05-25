-- ═══════════════════════════════════════════════════════════════════════════
-- BLANQUEO — DÍA OPERATIVO CERO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Resetea toda la data operativa mock de la base de datos, preservando:
--   - Configuración del sistema (system_config)
--   - Monitoreo (service_monitors)
--   - Tareas programadas (scheduled_tasks) — solo resetea contadores
--   - Catálogos (product_categories, installation_types, work_order_types,
--     ticket_categories, ticket_reasons, tags, roles)
--   - Geografía (cities, neighborhoods)
--   - Datos ISP reales (subscribers, nodes, plans, connections, clientes,
--     cliente_emails, cliente_telefonos, ppp_secrets)
--   - Usuario admin (is_superuser = true)
--
-- ⚠️  ATENCIÓN: Este script ELIMINA datos. Asegurate de tener un backup antes.
--
-- Uso:
--   psql -U emerald_owner -d emerald_stock -f scripts/blanqueo_dia_cero.sql
--
-- Para restaurar backup:
--   pg_dump -U emerald_owner -d emerald_stock > /tmp/emerald_backup_$(date +%Y%m%d).sql
--   psql -U emerald_owner -d emerald_stock < /tmp/emerald_backup_*.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 1: Tickets / OT / Engineering
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE ticket_tags RESTART IDENTITY;
TRUNCATE TABLE ticket_attachments RESTART IDENTITY;
TRUNCATE TABLE ticket_timeline RESTART IDENTITY;
TRUNCATE TABLE work_order_items RESTART IDENTITY;
TRUNCATE TABLE contact_attempts RESTART IDENTITY;
TRUNCATE TABLE engineering_task_timeline RESTART IDENTITY;
TRUNCATE TABLE engineering_tasks RESTART IDENTITY;
TRUNCATE TABLE work_orders RESTART IDENTITY;
TRUNCATE TABLE tickets RESTART IDENTITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2: Auth / Audit
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE api_key_audit RESTART IDENTITY;
TRUNCATE TABLE api_keys RESTART IDENTITY;
TRUNCATE TABLE login_attempts RESTART IDENTITY;
TRUNCATE TABLE audit_logs RESTART IDENTITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 3: Coordinación / Flota
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  Orden crítico:
--   1. vehicle_inspections  (FK vehicle → CASCADE, FK user → RESTRICT)
--   2. team_members         (FK team → CASCADE, FK user → CASCADE)
--   3. teams                (FK vehicle → SET NULL)
--   4. vehicles             (FK warehouse → RESTRICT — debe ir ANTES que warehouses)
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE vehicle_inspections RESTART IDENTITY;
TRUNCATE TABLE team_members RESTART IDENTITY;
TRUNCATE TABLE teams RESTART IDENTITY;
TRUNCATE TABLE vehicles RESTART IDENTITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4: Inventario / Depósitos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  Orden crítico:
--   1. stock_movements      (FK product → CASCADE, FK warehouse → SET NULL)
--   2. serial_items         (FK product → CASCADE, FK warehouse → RESTRICT)
--   3. stock_bulk           (FK warehouse → CASCADE, FK product → CASCADE)
--   4. warehouses           (raíz)
--   5. products             (raíz, catálogo)
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE stock_movements RESTART IDENTITY;
TRUNCATE TABLE serial_items RESTART IDENTITY;
TRUNCATE TABLE stock_bulk RESTART IDENTITY;
TRUNCATE TABLE warehouses RESTART IDENTITY;
TRUNCATE TABLE products RESTART IDENTITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 5: Usuarios no-admin
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  DELETE (no TRUNCATE) porque preservamos el usuario admin.
-- ⚠️  Primero eliminar team_members de usuarios no-admin por FK RESTRICT.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM team_members
WHERE user_id IN (SELECT id FROM users WHERE NOT is_superuser);

DELETE FROM users WHERE NOT is_superuser;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 6: Historial operativo (opcional)
-- ═══════════════════════════════════════════════════════════════════════════

TRUNCATE TABLE monitor_check_history RESTART IDENTITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-blanqueo: Resetear contadores de tareas programadas
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE scheduled_tasks SET execution_count = 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Tablas que deben estar VACÍAS
SELECT 'tickets' AS tabla, count(*) AS registros FROM tickets
UNION ALL
SELECT 'work_orders', count(*) FROM work_orders
UNION ALL
SELECT 'engineering_tasks', count(*) FROM engineering_tasks
UNION ALL
SELECT 'products', count(*) FROM products
UNION ALL
SELECT 'warehouses', count(*) FROM warehouses
UNION ALL
SELECT 'vehicles', count(*) FROM vehicles
UNION ALL
SELECT 'teams', count(*) FROM teams
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs
UNION ALL
SELECT 'api_keys', count(*) FROM api_keys
UNION ALL
SELECT 'login_attempts', count(*) FROM login_attempts
ORDER BY tabla;

-- Usuarios: solo admin debe quedar
SELECT 'admin_users' AS check_name, count(*) AS registros FROM users WHERE is_superuser = true;
SELECT 'non_admin_users' AS check_name, count(*) AS registros FROM users WHERE is_superuser = false;

-- Datos ISP preservados
SELECT 'clientes' AS tabla, count(*) AS registros FROM clientes
UNION ALL
SELECT 'connections', count(*) FROM connections
UNION ALL
SELECT 'nodes', count(*) FROM nodes
UNION ALL
SELECT 'subscribers', count(*) FROM subscribers
UNION ALL
SELECT 'plans', count(*) FROM plans;

-- Scheduled tasks contadores reseteados
SELECT 'scheduled_tasks_ok' AS check_name, count(*) AS total_com_reset
FROM scheduled_tasks WHERE execution_count = 0;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Fin del script
-- ═══════════════════════════════════════════════════════════════════════════
