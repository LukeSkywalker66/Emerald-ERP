# Guía Rápida: Ejecutar Blanqueo + Migración Hesk en Staging

> **Basado en:** Sesión de ejecución en desarrollo (2026-06-04/05)
> **Prerrequisito:** Haber mergeado la feature branch a develop

---

## ════════════════════════════════════════════════
## PASO 0: VERIFICAR ACCESO A STAGING
## ════════════════════════════════════════════════

```bash
# Ver containers activos
docker ps | grep emerald

# Verificar conexión a base de datos
docker compose -f docker-compose.staging.yml exec db psql -U emerald_owner -d emerald_stock -c "SELECT current_database(), version();"
```

---

## ════════════════════════════════════════════════
## PASO 1: BACKUP DE LA BASE (OBLIGATORIO)
## ════════════════════════════════════════════════

```bash
# Backup manual (por si el script falla)
docker compose -f docker-compose.staging.yml exec db pg_dump -U emerald_owner -d emerald_stock > /tmp/backup_staging_pre_blanqueo.sql
```

---

## ════════════════════════════════════════════════
## PASO 2: BLANQUEO DÍA CERO
## ════════════════════════════════════════════════

```bash
# 2a. Dry-run (MUY RECOMENDADO primero)
docker compose -f docker-compose.staging.yml exec backend python scripts/blanqueo_dia_cero.py

# 2b. Apply (con backup automático + confirmación)
docker compose -f docker-compose.staging.yml exec -it backend python scripts/blanqueo_dia_cero.py --apply
# → Escribir: BLANQUEO
```

**Qué hace:** Limpia 22 tablas operativas (tickets, OTs, products, warehouses, vehicles, equipos, audit_logs, etc.) y elimina usuarios no-admin. Preserva datos ISP, catálogos, geografía y admin.

**Verificar post-blanqueo:**
```bash
docker compose -f docker-compose.staging.yml exec db psql -U emerald_owner -d emerald_stock -c "
SELECT count(*) as tickets FROM tickets;
SELECT count(*) as work_orders FROM work_orders;
SELECT count(*) as products FROM products;
SELECT count(*) as clientes FROM clientes;
SELECT count(*) as usuarios_no_admin FROM users WHERE NOT is_superuser;
SELECT count(*) as usuarios_admin FROM users WHERE is_superuser = true;
"
```

---

## ════════════════════════════════════════════════
## PASO 3: MIGRACIÓN LEGACY HESK
## ════════════════════════════════════════════════

```bash
# 3a. Dry-run (MUY RECOMENDADO primero)
docker compose -f docker-compose.staging.yml exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --dry-run --samples 3'

# 3b. Apply migración (~10,114 tickets, ~17 minutos)
docker compose -f docker-compose.staging.yml exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --apply'
```

**Qué hace:** Parsea dump Hesk (~32MB) y migra cada ticket como 1 `Ticket` (closed) + 1 `TicketTimeline` (legacy_import) con todo el contenido empaquetado en JSONB.

**Nota:** El script necesita `scripts/legacy_data/c0soporte.sql` accesible desde el container. Si no está, copiarlo:
```bash
cp -r scripts/legacy_data backend/scripts/legacy_data/
```

---

## ════════════════════════════════════════════════
## PASO 4: BACKUP POST-MIGRACIÓN
## ════════════════════════════════════════════════

```bash
docker compose -f docker-compose.staging.yml exec db pg_dump -U emerald_owner -d emerald_stock > /tmp/backup_staging_post_migracion.sql
```

---

## ════════════════════════════════════════════════
## PASO 5: POST-MIGRACIÓN (MATCH + FECHAS + REPLIES)
## ════════════════════════════════════════════════

```bash
# 5a. Dry-run
docker compose -f docker-compose.staging.yml exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --dry-run'

# 5b. Apply (con confirmación)
docker compose -f docker-compose.staging.yml exec -it backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --apply'
# → Escribir: POSTMIGRACION
```

**Qué hace (5 etapas):**
1. Match por nombre + 1 conexión → asigna `connection_id`
2. Match por nombre + dirección (múltiples conexiones)
3. Match por DNI
4. Corrige `created_at` con fecha original de Hesk
5. Expande 44,453 replies como eventos `note` en timeline

---

## ════════════════════════════════════════════════
## VERIFICACIÓN FINAL
## ════════════════════════════════════════════════

```bash
docker compose -f docker-compose.staging.yml exec db psql -U emerald_owner -d emerald_stock -c "
SELECT 'Total tickets' as concepto, count(*)::text FROM tickets
UNION ALL
SELECT 'Con connection_id', count(*)::text FROM tickets WHERE connection_id IS NOT NULL
UNION ALL
SELECT 'Sin connection_id', count(*)::text FROM tickets t 
  JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' 
  WHERE t.connection_id IS NULL
UNION ALL
SELECT 'Replies legacy expandidas', count(*)::text FROM ticket_timeline 
  WHERE event_type='note' AND meta_data->>'source' = 'legacy_reply';
"
```

---

## ════════════════════════════════════════════════
## RESTAURACIÓN (VOLVER ATRÁS)
## ════════════════════════════════════════════════

```bash
# Restaurar backup pre-blanqueo
cat /tmp/backup_staging_pre_blanqueo.sql | docker compose -f docker-compose.staging.yml exec -T db psql -U emerald_owner -d emerald_stock

# O restaurar backup post-migración
cat /tmp/backup_staging_post_migracion.sql | docker compose -f docker-compose.staging.yml exec -T db psql -U emerald_owner -d emerald_stock
```

---

## ════════════════════════════════════════════════
## ORDEN RECOMENDADO (RESUMEN)
## ════════════════════════════════════════════════

```bash
# 1. Backup
docker compose -f docker-compose.staging.yml exec db pg_dump -U emerald_owner -d emerald_stock > /tmp/bkp1_pre_blanqueo.sql

# 2. Blanqueo
docker compose -f docker-compose.staging.yml exec -it backend python scripts/blanqueo_dia_cero.py --apply

# 3. Migración Hesk
docker compose -f docker-compose.staging.yml exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --apply'

# 4. Backup post-migración
docker compose -f docker-compose.staging.yml exec db pg_dump -U emerald_owner -d emerald_stock > /tmp/bkp2_post_migracion.sql

# 5. Post-migración
docker compose -f docker-compose.staging.yml exec -it backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --apply'
```

> **Tiempo estimado total:** ~25-30 minutos
> - Backup: ~1 min
> - Blanqueo: ~30 seg
> - Migración Hesk: ~17 min
> - Backup: ~1 min
> - Post-migración: ~30 seg
