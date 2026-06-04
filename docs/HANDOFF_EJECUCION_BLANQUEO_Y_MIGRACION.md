# Handoff: Ejecución de Blanqueo + Migración Legacy Hesk

> **Creado:** 2026-06-04
> **Última actualización:** 2026-06-04 (sesión de ejecución)
> **Estado:** ✅ Blanqueo completado en desarrollo. Pendiente migración Hesk.
> **Propósito:** Documento de contexto para que una nueva sesión de Zoocode ejecute el proceso completo de blanqueo de base de datos y migración de tickets legacy Hesk hacia Emerald ERP.

---

## ═══════════════════════════════════════════════════
## OBJETIVO GENERAL
## ═══════════════════════════════════════════════════

Preparar la base de datos para producción mediante:
1. **Blanqueo Día Cero** → Eliminar toda la data mock operativa (26 tablas en 6 fases)
2. **Migración Legacy Hesk** → Importar ~10,132 tickets históricos desde Hesk (MySQL) a Emerald (PostgreSQL)

---

## ═══════════════════════════════════════════════════
## ENTORNO
## ═══════════════════════════════════════════════════

- **Proyecto:** `/opt/emerald-dev`
- **Stack:** Docker Compose (desarrollo con `docker-compose.dev.yml`)
- **Contenedores clave:**
  - DB: `emerald_db_dev` (PostgreSQL 15, puerto host 5434)
  - Backend: `emerald_backend_dev` (puerto host 8502)
- **Credenciales DB:** `POSTGRES_USER=emerald_owner`, `POSTGRES_DB=emerald_stock`
- **Archivo .env:** Presente en raíz del proyecto

---

## ═══════════════════════════════════════════════════
## PASO 1: BLANQUEO DÍA CERO
## ═══════════════════════════════════════════════════

### Archivos relevantes

| Archivo | Rol |
|---------|------|
| [`scripts/blanqueo_dia_cero.sql`](scripts/blanqueo_dia_cero.sql) | SQL puro (alternativa directa con psql) |
| [`backend/scripts/blanqueo_dia_cero.py`](backend/scripts/blanqueo_dia_cero.py) | Script Python CLI (vía recomendada) |
| [`plans/PLAN_BLANQUEO_DIA_CERO.md`](plans/PLAN_BLANQUEO_DIA_CERO.md) | Plan detallado con inventario de 26 tablas |
| [`plans/EVALUACION_ARQUITECTONICA_BLANQUEO.md`](plans/EVALUACION_ARQUITECTONICA_BLANQUEO.md) | Evaluación arquitectónica |

### Comandos

```bash
# 1. Dry-run (MUY RECOMENDADO primero - no modifica nada)
docker compose -f docker-compose.dev.yml exec backend python scripts/blanqueo_dia_cero.py

# 2. Apply (ejecuta limpieza con backup automático)
docker compose -f docker-compose.dev.yml exec backend python scripts/blanqueo_dia_cero.py --apply
```

### ¿Qué hace?

**Limpia (26 tablas, 6 fases):**
1. Tickets/OT/Engineering (9 tablas)
2. Auth/Audit (4 tablas)
3. Coordinación/Flota (4 tablas)
4. Inventario/Depósitos (5 tablas)
5. Usuarios no-admin (DELETE)
6. Historial operativo (1 tabla)

**Preserva:**
- Configuración del sistema (`system_config`, `service_monitors`, `scheduled_tasks`)
- Catálogos (roles, tags, categories, product_categories, etc.)
- Geografía (cities, neighborhoods)
- Datos ISP reales (clientes, conexiones, nodos, planes, subscribers, PPP secrets)
- Usuario admin (`is_superuser = true`)

### Notas importantes
- El modo apply pide confirmación escribiendo `BLANQUEO`
- Genera backup automático en `/tmp/emerald_pre_blanqueo_*.sql`
- Si falla el backup, el script aborta sin ejecutar cambios
- Ya existe un backup manual: `/opt/emerald-dev/backup_0_con_mocks.sql`

---

## ═══════════════════════════════════════════════════
## PASO 2: MIGRACIÓN LEGACY HESK
## ═══════════════════════════════════════════════════

### Archivos relevantes

| Archivo | Rol |
|---------|------|
| [`scripts/migrate_legacy_tickets.py`](scripts/migrate_legacy_tickets.py) | Script ETL principal (784 líneas) |
| [`plans/PLAN_MIGRACION_HESK.md`](plans/PLAN_MIGRACION_HESK.md) | Plan detallado con mapeo de datos |
| [`scripts/legacy_data/c0soporte.sql`](scripts/legacy_data/c0soporte.sql) | Dump legacy Hesk (~32MB, 10,132 tickets) |
| [`scripts/legacy_data/esquema_hesk.sql`](scripts/legacy_data/esquema_hesk.sql) | Schema del sistema Hesk |

### Comandos

```bash
# 1. Dry-run (MUY RECOMENDADO - solo parsea y muestra samples)
docker compose -f docker-compose.dev.yml exec backend python scripts/migrate_legacy_tickets.py --dry-run --samples 3

# 2. Apply (ejecuta migración)
docker compose -f docker-compose.dev.yml exec backend python scripts/migrate_legacy_tickets.py --apply

# 3. Apply con chunk size personalizado
docker compose -f docker-compose.dev.yml exec backend python scripts/migrate_legacy_tickets.py --apply --chunk-size 50
```

### Estrategia "Modo Cápsula"

Cada ticket legacy → **2 registros** en Emerald:

```
hesk_tickets (10,132 rows)
  ├── Ticket (1 por ticket, status="closed")
  │     ├── subject → directo
  │     ├── priority → mapeo 0→critical, 1→high, 2→medium, 3→low
  │     ├── ticket_type → inferido por keywords del subject
  │     └── connection_details → JSONB (domicilio, teléfono, DNI, barrio, localidad)
  │
  └── TicketTimeline (1 por ticket, event_type="legacy_import")
        └── meta_data → JSONB:
              ├── legacy_ticket_id, legacy_trackid
              ├── client_info (nombre, email, dirección, etc.)
              ├── thread cronológico [original + replies ordenadas]
              ├── reply_count, staff_reply_count
              ├── history_html (audit trail Hesk)
              └── legacy_attachments
```

### Prerrequisitos (ya cumplidos)

| Requisito | Estado |
|-----------|--------|
| Enum `legacy_import` en [`TicketTimelineEventType`](backend/src/models/tickets.py:102) | ✅ Agregado (línea 102) |
| Migración Alembic | ✅ No necesaria (`native_enum=False`) |
| Dump legacy `c0soporte.sql` | ✅ Presente en `scripts/legacy_data/` |

### Características del script

- **Parseo SQL line-by-line:** Tokenizador custom que maneja comillas escapadas, NULLs, HTML, comas dentro de strings
- **No carga el dump completo en memoria:** Usa generadores de Python
- **Chunked batch processing:** Commit cada N tickets (default 100)
- **Detección de duplicados:** Salta tickets ya migrados (verifica por `legacy_ticket_id` en meta_data)
- **Manejo de errores:** Cada chunk es atómico, si falla hace rollback y continúa con el siguiente

---

## ═══════════════════════════════════════════════════
## ORDEN RECOMENDADO DE EJECUCIÓN
## ═══════════════════════════════════════════════════

```bash
# 1. Verificar containers activos
docker ps | grep emerald

# 2. DRY-RUN del blanqueo (ver qué se va a limpiar)
docker compose -f docker-compose.dev.yml exec backend python scripts/blanqueo_dia_cero.py

# 3. APPLY del blanqueo (limpiar DB)
docker compose -f docker-compose.dev.yml exec backend python scripts/blanqueo_dia_cero.py --apply

# 4. DRY-RUN de migración Hesk (ver samples del JSONB)
docker compose -f docker-compose.dev.yml exec backend python scripts/migrate_legacy_tickets.py --dry-run --samples 3

# 5. APPLY de migración Hesk
docker compose -f docker-compose.dev.yml exec backend python scripts/migrate_legacy_tickets.py --apply
```

### Verificación post-blanqueo

```sql
SELECT count(*) FROM tickets;               -- 0
SELECT count(*) FROM work_orders;            -- 0
SELECT count(*) FROM products;               -- 0
SELECT count(*) FROM warehouses;             -- 0
SELECT count(*) FROM vehicles;               -- 0
SELECT count(*) FROM teams;                  -- 0
SELECT count(*) FROM users WHERE NOT is_superuser;  -- 0
SELECT count(*) FROM users WHERE is_superuser;      -- >= 1
SELECT count(*) FROM clientes;               -- > 0 (datos ISP preservados)
```

### Restauración (volver a estado mock)

```bash
# Usando el backup automático
cat /tmp/emerald_pre_blanqueo_*.sql | docker compose -f docker-compose.dev.yml exec -T db psql -U emerald_owner -d emerald_stock

# O usando el flag del script
docker compose -f docker-compose.dev.yml exec backend python scripts/blanqueo_dia_cero.py --apply --restore /tmp/emerald_pre_blanqueo_*.sql
```

---

## ═══════════════════════════════════════════════════
## REFERENCIAS
## ═══════════════════════════════════════════════════

- Plan de blanqueo: [`plans/PLAN_BLANQUEO_DIA_CERO.md`](plans/PLAN_BLANQUEO_DIA_CERO.md)
- Evaluación arquitectónica: [`plans/EVALUACION_ARQUITECTONICA_BLANQUEO.md`](plans/EVALUACION_ARQUITECTONICA_BLANQUEO.md)
- Plan de migración Hesk: [`plans/PLAN_MIGRACION_HESK.md`](plans/PLAN_MIGRACION_HESK.md)
- Backup manual existente: [`backup_0_con_mocks.sql`](backup_0_con_mocks.sql)
- Doc backup anterior: [`docs/CMD_Bkp_DDB.md`](docs/CMD_Bkp_DDB.md)
