#!/usr/bin/env python3
"""
Post-migración Hesk → Emerald ERP
====================================
Script que completa la integración de tickets migrados desde Hesk:
1. Match con clientes/connections existentes
2. Expansión de replies como eventos de timeline
3. Corrección de created_at con fecha original

Uso:
  python scripts/post_migracion_hesk.py --dry-run   # Solo análisis
  python scripts/post_migracion_hesk.py --apply     # Ejecutar
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Configurar logging antes de imports problemáticos ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("PostMigracionHesk")

# ── SQL Statements ──────────────────────────────────────────────────────────

STAGE1_SQL = """
UPDATE tickets t
SET connection_id = (
    SELECT con.connection_id
    FROM clientes cl
    JOIN connections con ON con.customer_id = cl.id
    WHERE cl.name = (
        SELECT meta_data->'client_info'->>'name'
        FROM ticket_timeline
        WHERE ticket_id = t.id AND event_type = 'legacy_import'
        LIMIT 1
    )
    AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) = 1
    LIMIT 1
)
WHERE t.id IN (
    SELECT t2.id FROM tickets t2
    JOIN ticket_timeline tl ON tl.ticket_id = t2.id AND tl.event_type = 'legacy_import'
    JOIN clientes cl ON cl.name = tl.meta_data->'client_info'->>'name'
    WHERE t2.connection_id IS NULL
    AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) = 1
);
"""

STAGE2_SQL = """
UPDATE tickets t
SET connection_id = subq.connection_id
FROM (
    SELECT DISTINCT ON (t2.id) t2.id AS ticket_id, con.connection_id
    FROM tickets t2
    JOIN ticket_timeline tl ON tl.ticket_id = t2.id AND tl.event_type = 'legacy_import'
    JOIN clientes cl ON cl.name = tl.meta_data->'client_info'->>'name'
    JOIN connections con ON con.customer_id = cl.id
    WHERE t2.connection_id IS NULL
    AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) > 1
    AND (
        REPLACE(LOWER(TRIM(con.direccion)), '  ', ' ') 
        LIKE '%' || REPLACE(LOWER(TRIM(t2.connection_details->>'address')), '  ', ' ') || '%'
        OR REPLACE(LOWER(TRIM(t2.connection_details->>'address')), '  ', ' ')
        LIKE '%' || REPLACE(LOWER(TRIM(con.direccion)), '  ', ' ') || '%'
    )
) subq
WHERE t.id = subq.ticket_id AND t.connection_id IS NULL;
"""

STAGE3_SQL = """
UPDATE tickets t
SET connection_id = (
    SELECT con.connection_id
    FROM clientes cl
    JOIN connections con ON con.customer_id = cl.id
    WHERE cl.doc_number = (
        SELECT meta_data->'client_info'->>'client_dni'
        FROM ticket_timeline
        WHERE ticket_id = t.id AND event_type = 'legacy_import'
        LIMIT 1
    )
    AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) = 1
    LIMIT 1
)
WHERE t.id IN (
    SELECT t2.id FROM tickets t2
    JOIN ticket_timeline tl ON tl.ticket_id = t2.id AND tl.event_type = 'legacy_import'
    JOIN clientes cl ON cl.doc_number = tl.meta_data->'client_info'->>'client_dni'
    WHERE t2.connection_id IS NULL
    AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) = 1
);
"""

STAGE4_SQL = """
UPDATE tickets t
SET created_at = subq.fecha_original,
    updated_at = subq.fecha_original
FROM (
    SELECT t2.id,
           (tl.meta_data->'thread'->0->>'date')::timestamp AT TIME ZONE 'UTC' AS fecha_original
    FROM tickets t2
    JOIN ticket_timeline tl ON tl.ticket_id = t2.id AND tl.event_type = 'legacy_import'
    WHERE tl.meta_data->'thread'->0->>'date' IS NOT NULL
    AND tl.meta_data->'thread'->0->>'date' != ''
) subq
WHERE t.id = subq.id;
"""

STAGE5_SQL_EXPAND = """
INSERT INTO ticket_timeline (ticket_id, event_type, content, meta_data, created_at)
SELECT
    t.id,
    'note',
    -- Concatenar el nombre del autor legacy en el texto de la nota
    CASE
        WHEN reply->>'author' IS NOT NULL AND reply->>'author'::text != ''
        THEN CONCAT(reply->>'author'::text, ' escribió: ', reply->>'body'::text)
        ELSE reply->>'body'::text
    END,
    jsonb_build_object(
        'source', 'legacy_reply',
        'author_original', reply->>'author',
        'date_original', reply->>'date',
        'staff_id', reply->>'staff_id'
    ),
    COALESCE(
        (reply->>'date')::timestamp AT TIME ZONE 'UTC',
        t.created_at
    )
FROM tickets t
JOIN ticket_timeline tl ON tl.ticket_id = t.id AND tl.event_type = 'legacy_import'
CROSS JOIN LATERAL jsonb_array_elements(tl.meta_data->'thread') WITH ORDINALITY AS reply_elem(reply, ord)
WHERE ord > 1
  AND reply->>'type' = 'reply'
  AND NOT EXISTS (
      SELECT 1 FROM ticket_timeline existing
      WHERE existing.ticket_id = t.id
      AND existing.event_type = 'note'
      AND existing.meta_data->>'source' = 'legacy_reply'
      AND existing.meta_data->>'date_original' = reply->>'date'
  );
"""


def report_count(session, label, sql):
    """Ejecuta una query de conteo y loggea el resultado."""
    from sqlalchemy import text
    try:
        result = session.execute(text(sql))
        val = result.scalar() or 0
        log.info("  %s: %d", label, val)
        return val
    except Exception as e:
        log.warning("  %s: ERROR - %s", label, e)
        return -1


def run_stage(session, label, sql):
    """Ejecuta una etapa de actualización y retorna filas afectadas."""
    from sqlalchemy import text
    try:
        result = session.execute(text(sql))
        affected = result.rowcount
        log.info("  ✅ %s: %d filas actualizadas", label, affected)
        return affected
    except Exception as e:
        log.error("  ❌ %s: %s", label, e)
        session.rollback()
        return -1


def main():
    # ── Importar dependencias de Emerald (dentro de main para evitar sys.path) ──
    _SCRIPT_DIR = Path(__file__).resolve().parent
    _SRC_PATH = str(_SCRIPT_DIR.parent / "src")
    if _SRC_PATH not in sys.path:
        sys.path.insert(0, _SRC_PATH)

    from src.database import SessionLocal, engine
    from sqlalchemy import text

    parser = argparse.ArgumentParser(
        description="Post-migración Hesk → Emerald: match clientes, expandir replies, corregir fechas"
    )
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Modo análisis: muestra conteos sin modificar datos")
    parser.add_argument("--apply", "-a", action="store_true",
                        help="Ejecutar todas las etapas de post-migración")
    parser.add_argument("--skip-replies", action="store_true",
                        help="Saltar la expansión de replies (lleva tiempo)")
    parser.add_argument("--skip-dates", action="store_true",
                        help="Saltar la corrección de created_at")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("❌ Debes especificar --dry-run o --apply")
        sys.exit(1)

    # ── Conectar ──
    log.info("🔌 Conectando a PostgreSQL ...")
    try:
        session = SessionLocal()
        session.execute(text("SELECT 1"))
        url = engine.url
        log.info("✅ Conectado a %s@%s:%s/%s", url.username, url.host, url.port, url.database)
    except Exception as e:
        log.error("❌ Error conectando: %s", e)
        sys.exit(1)

    start_time = time.time()

    try:
        # ── REPORTE INICIAL ──
        log.info("")
        log.info("═" * 60)
        log.info("  POST-MIGRACIÓN HESK → EMERALD ERP")
        log.info("═" * 60)
        log.info("  Modo: %s", "DRY-RUN (solo análisis)" if args.dry_run else "APPLY")
        log.info("")

        report_count(session, "Total tickets legacy",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import'")
        report_count(session, "Con connection_id",
            "SELECT count(*) FROM tickets WHERE connection_id IS NOT NULL")
        report_count(session, "SIN connection_id",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' WHERE t.connection_id IS NULL")

        report_count(session, "→ Match potencial por nombre + 1 conexión",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' JOIN clientes cl ON cl.name = tl.meta_data->'client_info'->>'name' WHERE t.connection_id IS NULL AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) = 1")
        report_count(session, "→ Match potencial por nombre + dirección",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' JOIN clientes cl ON cl.name = tl.meta_data->'client_info'->>'name' JOIN connections con ON con.customer_id = cl.id WHERE t.connection_id IS NULL AND (SELECT count(*) FROM connections WHERE customer_id = cl.id) > 1")
        report_count(session, "→ Match potencial por DNI",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' JOIN clientes cl ON cl.doc_number = tl.meta_data->'client_info'->>'client_dni' WHERE t.connection_id IS NULL")
        report_count(session, "Replies a expandir",
            "SELECT COALESCE(sum(jsonb_array_length(tl.meta_data->'thread') - 1), 0) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' WHERE jsonb_array_length(tl.meta_data->'thread') > 1")

        if args.dry_run:
            log.info("")
            log.info("═" * 60)
            log.info("  ✅ Dry-run completado. Usá --apply para ejecutar.")
            log.info("═" * 60)
            return

        # ── APPLY ──
        log.info("")
        log.warning("⚠️  Se aplicarán cambios permanentes en la base de datos.")
        confirm = input("  ¿Continuar? (escribe 'POSTMIGRACION' para confirmar): ")
        if confirm.strip() != "POSTMIGRACION":
            log.info("Cancelado.")
            session.close()
            return

        # Etapa 1
        log.info("")
        log.info("📌 ETAPA 1/5: Match por nombre + 1 conexión")
        run_stage(session, "Match nombre+1con", STAGE1_SQL)
        session.commit()

        # Etapa 2
        log.info("")
        log.info("📌 ETAPA 2/5: Match por nombre + dirección")
        run_stage(session, "Match nombre+dirección", STAGE2_SQL)
        session.commit()

        # Etapa 3
        log.info("")
        log.info("📌 ETAPA 3/5: Match por DNI")
        run_stage(session, "Match DNI", STAGE3_SQL)
        session.commit()

        # Etapa 4
        if not args.skip_dates:
            log.info("")
            log.info("📌 ETAPA 4/5: Corregir created_at")
            run_stage(session, "created_at corregido", STAGE4_SQL)
            session.commit()
        else:
            log.info("")
            log.info("📌 ETAPA 4/5: ⏭️  Corrección de created_at saltada")

        # Etapa 5
        if not args.skip_replies:
            log.info("")
            log.info("📌 ETAPA 5/5: Expandir replies en timeline")
            run_stage(session, "Replies expandidas", STAGE5_SQL_EXPAND)
            session.commit()
        else:
            log.info("")
            log.info("📌 ETAPA 5/5: ⏭️  Expansión de replies saltada")

        # ── VERIFICACIÓN ──
        log.info("")
        log.info("═" * 60)
        log.info("  ✅ VERIFICACIÓN POST-MIGRACIÓN")
        log.info("═" * 60)

        report_count(session, "Total tickets legacy",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import'")
        report_count(session, "Con connection_id",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' WHERE t.connection_id IS NOT NULL")
        report_count(session, "SIN connection_id (pendientes)",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' WHERE t.connection_id IS NULL")
        report_count(session, "Eventos de timeline (notes legacy)",
            "SELECT count(*) FROM ticket_timeline WHERE event_type='note' AND meta_data->>'source' = 'legacy_reply'")
        report_count(session, "Fechas corregidas",
            "SELECT count(*) FROM tickets t JOIN ticket_timeline tl ON tl.ticket_id=t.id AND tl.event_type='legacy_import' WHERE t.created_at != t.updated_at OR date(t.created_at) < '2026-06-01'")

        elapsed = time.time() - start_time
        log.info("")
        log.info("  Duración total: %.1f segundos", elapsed)
        log.info("")
        log.info("✅ Post-migración completada exitosamente.")

    except KeyboardInterrupt:
        log.warning("\n⚠️  Interrupción. Haciendo rollback...")
        session.rollback()
        log.info("Rollback completado.")
        sys.exit(1)
    except Exception as e:
        log.error("❌ Error fatal: %s", e)
        session.rollback()
        sys.exit(1)
    finally:
        session.close()
        log.info("🔌 Conexión cerrada.")


if __name__ == "__main__":
    main()
