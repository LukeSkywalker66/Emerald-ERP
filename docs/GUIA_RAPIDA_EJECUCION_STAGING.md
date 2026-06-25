# Guía Rápida: Ejecutar Blanqueo + Migración Hesk

> **Basado en:** Sesión de ejecución en desarrollo (2026-06-04/05)
> **Prerrequisito:** Haber mergeado la feature branch a develop
>
> ⚠️ Las variables `$POSTGRES_USER` y `$POSTGRES_DB` se expanden **dentro** del container
> (docker compose inyecta las variables del .env al container).
> El `.env` de cada entorno define `COMPOSE_FILE`, `POSTGRES_USER` y `POSTGRES_DB`.

---

## ════════════════════════════════════════════════
## PASO 0: VERIFICAR ACCESO
## ════════════════════════════════════════════════

```bash
# Ver containers activos
docker ps | grep emerald

# Verificar conexión (las variables se expanden DENTRO del container)
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT current_database(), version();"'
```

---

## ════════════════════════════════════════════════
## PASO 1: BACKUP DE LA BASE (OBLIGATORIO)
## ════════════════════════════════════════════════

```bash
docker compose exec db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' > /tmp/backup_pre_blanqueo.sql
```

---

## ════════════════════════════════════════════════
## PASO 2: BLANQUEO DÍA CERO
## ════════════════════════════════════════════════

```bash
# 2a. Dry-run (MUY RECOMENDADO primero - no modifica nada)
docker compose exec backend python scripts/blanqueo_dia_cero.py

# 2b. Apply (genera backup automático + pide confirmación)
docker compose exec -it backend python scripts/blanqueo_dia_cero.py --apply
# → Escribir: BLANQUEO
```

**Verificar post-blanqueo:**
```bash
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
SELECT * FROM
  (SELECT count(*) AS tickets FROM tickets) a,
  (SELECT count(*) AS work_orders FROM work_orders) b,
  (SELECT count(*) AS products FROM products) c,
  (SELECT count(*) AS clientes FROM clientes) d,
  (SELECT count(*) AS usuarios_admin FROM users WHERE is_superuser = true) e,
  (SELECT count(*) AS usuarios_no_admin FROM users WHERE NOT is_superuser) f;
"'
```

---

## ════════════════════════════════════════════════
## PASO 3: MIGRACIÓN ALEMBIC (conversión de enums)
## ════════════════════════════════════════════════

```bash
# Los modelos usan native_enum=False pero las tablas se crearon con
# enums nativos. Esta migración los convierte a VARCHAR.
docker compose exec backend sh -c 'PYTHONPATH=/app/src alembic upgrade head'
```

---

## ════════════════════════════════════════════════
## PASO 4: MIGRACIÓN LEGACY HESK
## ════════════════════════════════════════════════

```bash
# 3a. Dry-run (MUY RECOMENDADO primero)
docker compose exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --dry-run --samples 3'

# 3b. Apply migración (~10,114 tickets, ~17 minutos)
docker compose exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --apply'
```

**Nota:** Si el dump legacy no está accesible desde el container:
```bash
cp -r scripts/legacy_data backend/scripts/legacy_data/
```

---

## ════════════════════════════════════════════════
## PASO 5: BACKUP POST-MIGRACIÓN
## ════════════════════════════════════════════════

```bash
docker compose exec db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' > /tmp/backup_post_migracion.sql
```

---

## ════════════════════════════════════════════════
## PASO 6: POST-MIGRACIÓN (MATCH + FECHAS + REPLIES)
## ════════════════════════════════════════════════

```bash
# 5a. Dry-run
docker compose exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --dry-run'

# 5b. Apply (con confirmación)
docker compose exec -it backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --apply'
# → Escribir: POSTMIGRACION
```

**Qué hace (5 etapas):**
1. Match por nombre + 1 conexión → asigna `connection_id`
2. Match por nombre + dirección (múltiples conexiones)
3. Match por DNI
4. Corrige `created_at` y `updated_at` con fecha original de Hesk
5. Expande replies como eventos `note` en timeline

---

## ════════════════════════════════════════════════
## VERIFICACIÓN FINAL
## ════════════════════════════════════════════════

```bash
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
SELECT '\''Total tickets'\'' as concepto, count(*)::text FROM tickets
UNION ALL
SELECT '\''Con connection_id'\'', count(*)::text FROM tickets WHERE connection_id IS NOT NULL
UNION ALL
SELECT '\''Sin connection_id (pendientes)'\'', count(*)::text FROM tickets t
  JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='\''legacy_import'\''
  WHERE t.connection_id IS NULL
UNION ALL
SELECT '\''Replies legacy expandidas'\'', count(*)::text FROM ticket_timeline
  WHERE event_type='\''note'\'' AND meta_data->>'\''source'\'' = '\''legacy_reply'\'';
"'
```

---

## ════════════════════════════════════════════════
## ORDEN RESUMEN (COPY-PASTE LIMPIO)
## ════════════════════════════════════════════════

```bash
# ⚠️ Verificar COMPOSE_FILE en el .env del entorno correspondiente
#    Desarrollo:  COMPOSE_FILE=docker-compose.dev.yml
#    Staging:     COMPOSE_FILE=docker-compose.staging.yml
#    Producción:  COMPOSE_FILE=docker-compose.yml

# 1. Backup
docker compose exec db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' > /tmp/bkp_pre_blanqueo.sql

# 2. Blanqueo
docker compose exec -it backend python scripts/blanqueo_dia_cero.py --apply

# 3. Migración Hesk
docker compose exec backend sh -c 'PYTHONPATH=/app/src python -m scripts.migrate_legacy_tickets --apply'

# 4. Backup post-migración
docker compose exec db sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' > /tmp/bkp_post_migracion.sql

# 5. Post-migración
docker compose exec -it backend sh -c 'PYTHONPATH=/app/src python -m scripts.post_migracion_hesk --apply'
```

> **Tiempo estimado total:** ~25-30 minutos
> | Paso | Duración |
> |------|:--------:|
> | Backup | ~1 min |
> | Blanqueo | ~30 seg |
> | Migración Hesk | ~17 min |
> | Backup | ~1 min |
> | Post-migración | ~30 seg |
# Apaga los contenedores de este entorno y elimina sus huérfanos de red
docker compose down --remove-orphans
# Reconstruye las imágenes ignorando la caché anterior
docker compose build --no-cache
# Levanta los servicios obligando a recrear los contenedores
docker compose up -d --force-recreate
# Actualizar migraciones de alembic
docker exec emerald_backend_staging alembic upgrade head

# seeding de estructura inicial
docker exec emerald_backend_staging python scripts/provision_seed_data.py


