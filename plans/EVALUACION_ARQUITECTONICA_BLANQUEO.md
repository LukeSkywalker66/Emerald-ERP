# Evaluación Arquitectónica: Proceso de Blanqueo (Día Operativo Cero)

> **Propósito:** Documento para revisión del arquitecto del sistema. Describe el proceso, decisiones técnicas, riesgos y validaciones del script de blanqueo que resetea la base de datos a estado "día cero" para puesta en producción.

---

## 1. Objetivo

Eliminar todos los datos transaccionales de prueba/mock de la base de datos, preservando únicamente:

- **Configuración del sistema** (`system_config`, `service_monitors`, `scheduled_tasks`)
- **Catálogos base** (`product_categories`, `roles`, `tags`, `ticket_categories`, etc.)
- **Geografía** (`cities`, `neighborhoods`)
- **Datos ISP reales** sincronizados (clientes, conexiones, nodos, planes, subscribers, PPP secrets)
- **Usuario administrador** (`is_superuser = True`)

## 2. Inventario de Tablas

### 2.1 Tablas a resetear (26 tablas en 6 fases)

| Fase | Módulo | Tablas | Cantidad |
|------|--------|--------|:--------:|
| 1 | Tickets / OT / Engineering | `ticket_tags`, `ticket_attachments`, `ticket_timeline`, `work_order_items`, `contact_attempts`, `engineering_task_timeline`, `engineering_tasks`, `work_orders`, `tickets` | 9 |
| 2 | Auth / Audit | `api_key_audit`, `api_keys`, `login_attempts`, `audit_logs` | 4 |
| 3 | Coordinación / Flota | `vehicle_inspections`, `team_members`, `teams`, `vehicles` | 4 |
| 4 | Inventario / Depósitos | `stock_movements`, `serial_items`, `stock_bulk`, `warehouses`, `products` | 5 |
| 5 | Usuarios | `users` (DELETE no-admin) | 1 |
| 6 | Historial operativo | `monitor_check_history` | 1 |

### 2.2 Tablas preservadas (19 tablas)

`subscribers`, `nodes`, `plans`, `connections`, `clientes`, `cliente_emails`, `cliente_telefonos`, `ppp_secrets`, `sync_status`, `product_categories`, `installation_types`, `work_order_types`, `ticket_categories`, `ticket_reasons`, `tags`, `roles`, `cities`, `neighborhoods`, `system_config`, `service_monitors`, `scheduled_tasks`

## 3. Orden de Borrado y Dependencias FK

El orden de las 6 fases está diseñado para respetar todas las restricciones de Foreign Key. Cada `TRUNCATE` usa `RESTART IDENTITY CASCADE` como safety net para FKs hijas no anticipadas.

### Diagrama de dependencias

```
FASE 1 ── Tickets/OT/Engineering
  ticket_tags, ticket_attachments, ticket_timeline (hijos de tickets)
  → work_order_items, contact_attempts (hijos de work_orders)
  → engineering_task_timeline (hijo de engineering_tasks)
  → engineering_tasks, work_orders (hijos de tickets)
  → tickets (raíz)

FASE 2 ── Auth/Audit
  api_key_audit → api_keys
  login_attempts, audit_logs (sin FKs restrictivas)

FASE 3 ── Coordinación/Flota
  vehicle_inspections (FK technician_id → users RESTRICT ⚠️)
  → team_members (FK user_id → users, FK team_id → teams)
  → teams (FK vehicle_id → vehicles SET NULL)
  → vehicles (FK warehouse_id → warehouses RESTRICT ⚠️)
  ⚠️ vehicles DEBE ir ANTES que warehouses (Fase 4)

FASE 4 ── Inventario/Depósitos
  stock_movements (FK user_id → users RESTRICT ⚠️)
  → serial_items (FK warehouse_id → warehouses RESTRICT ⚠️)
  → stock_bulk, warehouses, products

FASE 5 ── Usuarios (DELETE)
  DELETE team_members WHERE user_id IN (no-admin)
  → DELETE users WHERE NOT is_superuser

FASE 6 ── Historial (opcional)
  monitor_check_history
```

### Restricciones críticas

| FK | Comportamiento | Impacto |
|----|---------------|---------|
| `vehicles.warehouse_id` | `ondelete=RESTRICT` | Vehicles debe truncarse ANTES que warehouses |
| `serial_items.warehouse_id` | `ondelete=RESTRICT` | Serial items debe truncarse ANTES que warehouses |
| `vehicle_inspections.technician_id` | `ondelete=RESTRICT` | Vehicle inspections debe truncarse ANTES que usuarios no-admin |
| `stock_movements.user_id` | `ondelete=RESTRICT` | Stock movements debe truncarse ANTES que usuarios no-admin |

## 4. Arquitectura del Script

### 4.1 Componentes

```
backend/scripts/blanqueo_dia_cero.py
├── Conexión: SQLAlchemy (src.database.SessionLocal)
│   └── Reusa engine/config del backend — sin duplicación
├── CLI: argparse
│   ├── --dry-run (default) → transacción + ROLLBACK
│   └── --apply → backup + TRUNCATE + COMMIT
├── Backup: subprocess + pg_dump
│   └── /tmp/emerald_pre_blanqueo_YYYYMMDD_HHMMSS.sql
├── Fases: 6 pasos ordered
│   └── Cada TRUNCATE usa RESTART IDENTITY CASCADE
├── Verificación: conteo antes/después por tabla
└── Restore: --restore <path> (requiere --apply)
```

### 4.2 Dependencias

- **Python**: 3.11+
- **Paquetes**: `sqlalchemy`, `psycopg2-binary` (ya en requirements.txt del backend)
- **Sistema**: `pg_dump`, `psql` (PostgreSQL client)
- **Ejecución**: Debe correr dentro del container backend (`docker compose exec backend`)

### 4.3 Flujo de ejecución

```
main()
├── Conectar DB via SessionLocal
├── ¿--restore? → psql restore + exit
├── ¿--apply?
│   ├── Confirmación "BLANQUEO"
│   ├── backup_database() → pg_dump
│   ├── Loop fases 1-4: TRUNCATE CASCADE
│   ├── Fase 5: DELETE usuarios no-admin
│   ├── Fase 6: TRUNCATE monitor_check_history
│   ├── UPDATE scheduled_tasks SET execution_count=0
│   ├── session.commit()
│   └── Verificación post-blanqueo
└── ¿--dry-run? (default)
    ├── Loop fases 1-4: TRUNCATE CASCADE (en transacción)
    ├── Fase 5: conteo de usuarios a eliminar
    ├── session.rollback()
    └── Reporte de tablas preservadas
```

## 5. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|:-----------:|:-------:|------------|
| Error en backup antes de apply | Baja | Alto | Script aborta si pg_dump falla. No ejecuta ningún TRUNCATE |
| FK no mapeada causa error de TRUNCATE | Baja | Medio | Cada TRUNCATE usa CASCADE, lo arrastra automáticamente |
| Rollback en dry-run no funciona | Muy baja | Ninguno | Dry-run no persiste cambios. Sesión se cierra sin commit |
| Datos ISP se borran accidentalmente | Muy baja | Alto | Tablas ISP no están en ninguna fase de TRUNCATE. Verificación post-blanqueo confirma que siguen intactas |
| Admin user se borra por error | Muy baja | Alto | DELETE usa filtro `WHERE NOT is_superuser`. Verificación post-blanqueo confirma `count(*) WHERE is_superuser = True > 0` |
| Conexión DB falla (fuera del container) | Media | Bajo | Script requiere ejecución dentro del container backend. Mensaje de error claro |

## 6. Estrategia de Testing

### 6.1 Dry-run (seguro)

```bash
docker compose exec backend python scripts/blanqueo_dia_cero.py
```

- Ejecuta todos los comandos dentro de una transacción SQL
- Muestra conteos "antes" de cada tabla
- Ejecuta TRUNCATE, DELETE, UPDATE (todo en memoria)
- Hace ROLLBACK — base de datos intacta
- Muestra conteos de tablas preservadas

### 6.2 Apply (con backup)

```bash
docker compose exec backend python scripts/blanqueo_dia_cero.py --apply
```

1. Genera backup: `/tmp/emerald_pre_blanqueo_20260525_221500.sql`
2. Si el backup falla → aborta. No se ejecuta ningún cambio.
3. Ejecuta cambios + COMMIT
4. Muestra verificación post-blanqueo

### 6.3 Restauración (vuelta a datos mock)

```bash
cat /tmp/emerald_pre_blanqueo_20260525_221500.sql | \
  docker compose exec -T db psql -U emerald_owner -d emerald_stock
```

O usando el flag del script:
```bash
docker compose exec backend python scripts/blanqueo_dia_cero.py \
  --apply --restore /tmp/emerald_pre_blanqueo_20260525_221500.sql
```

## 7. Verificación Post-Blanqueo

El script verifica automáticamente al finalizar:

| Consulta | Esperado |
|----------|----------|
| `SELECT count(*) FROM tickets` | 0 |
| `SELECT count(*) FROM work_orders` | 0 |
| `SELECT count(*) FROM products` | 0 |
| `SELECT count(*) FROM warehouses` | 0 |
| `SELECT count(*) FROM vehicles` | 0 |
| `SELECT count(*) FROM users WHERE NOT is_superuser` | 0 |
| `SELECT count(*) FROM users WHERE is_superuser` | >= 1 |
| `SELECT count(*) FROM clientes` | > 0 (ISP data preservada) |
| `SELECT count(*) FROM scheduled_tasks WHERE execution_count = 0` | = total scheduled_tasks |

## 8. Archivos del Proyecto

| Archivo | Rol |
|---------|-----|
| [`backend/scripts/blanqueo_dia_cero.py`](../backend/scripts/blanqueo_dia_cero.py) | Script principal Python (CLI dry-run/apply) |
| [`scripts/blanqueo_dia_cero.sql`](../scripts/blanqueo_dia_cero.sql) | SQL puro (alternativa directa con psql) |
| [`plans/PLAN_BLANQUEO_DIA_CERO.md`](PLAN_BLANQUEO_DIA_CERO.md) | Plan detallado con análisis de 26 tablas |

## 9. Decisión Pendiente

El banner post-blanqueo incluye el mensaje:

> **⚠️ El stock físico de inventario en pañoles/almacenes no se altera por SQL. Logística debe realizar el conteo manual inicial de stock_bulk y serial_items.**

Esto es correcto — el script TRUNCatea `stock_bulk` y `serial_items` (eran datos mock). Queda a criterio del negocio si se desea poblar con un inventario inicial o dejarlo en cero para que logística haga el relevamiento desde cero.

---

*Documento generado para revisión arquitectónica. Commits: `ffd6430` (script), `4b59cd6` (plan + SQL). Rama: `refactor/api-routing-standards`.*
