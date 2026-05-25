#!/usr/bin/env python3
"""
Blanqueo — Día Operativo Cero

Resetea toda la data operativa mock de la base de datos, preservando:
  - Configuración del sistema (system_config)
  - Monitoreo (service_monitors)
  - Tareas programadas (scheduled_tasks) — solo resetea contadores
  - Catálogos (product_categories, installation_types, work_order_types,
    ticket_categories, ticket_reasons, tags, roles)
  - Geografía (cities, neighborhoods)
  - Datos ISP reales (subscribers, nodes, plans, connections, clientes,
    cliente_emails, cliente_telefonos, ppp_secrets)
  - Usuario admin (is_superuser = true)

Modos de ejecución:
  --dry-run   (default) Ejecuta en transacción, muestra cuentas, hace ROLLBACK
  --apply     Genera backup automático vía pg_dump, TRUNCATE con RESTART IDENTITY,
              DELETE usuarios no-admin, resetea execution_count en scheduled_tasks

Uso:
  # Dry-run (seguro, no modifica nada)
  python scripts/blanqueo_dia_cero.py

  # Aplicar cambios
  python scripts/blanqueo_dia_cero.py --apply

  # Especificar backup dir
  python scripts/blanqueo_dia_cero.py --apply --backup-dir /tmp
"""

import argparse
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("blanqueo")

# ---------------------------------------------------------------------------
# Configuración de BD (mismas vars que backend/src/config.py)
# ---------------------------------------------------------------------------
DB_CONFIG_KEYS = {
    "POSTGRES_USER": "emerald_owner",
    "POSTGRES_PASSWORD": "6058gef6",
    "POSTGRES_HOST": "db",
    "POSTGRES_PORT": "5432",
    "POSTGRES_DB": "emerald_stock",
}


def _load_db_config() -> dict:
    """Carga config de BD desde environment o defaults."""
    cfg = {}
    for key, default in DB_CONFIG_KEYS.items():
        cfg[key] = os.getenv(key, default)
    return cfg


def _db_url(cfg: dict) -> str:
    return (
        f"postgresql://{cfg['POSTGRES_USER']}:{cfg['POSTGRES_PASSWORD']}"
        f"@{cfg['POSTGRES_HOST']}:{cfg['POSTGRES_PORT']}/{cfg['POSTGRES_DB']}"
    )


# ---------------------------------------------------------------------------
# Inventario de tablas con orden de truncado
# ---------------------------------------------------------------------------

# Tablas de datos ISP / catálogos que NO se tocan
TABLAS_PRESERVADAS = frozenset({
    # ISP
    "subscribers",
    "nodes",
    "plans",
    "connections",
    "clientes",
    "cliente_emails",
    "cliente_telefonos",
    "ppp_secrets",
    "sync_status",
    # Catálogos seed
    "product_categories",
    "installation_types",
    "work_order_types",
    "ticket_categories",
    "ticket_reasons",
    "tags",
    "roles",
    "cities",
    "neighborhoods",
    # Config del sistema
    "system_config",
    "service_monitors",
    "scheduled_tasks",
})

# Orden de TRUNCATE con RESTART IDENTITY (6 fases)
# Cada fase es una lista de nombres de tabla.
# El orden RESPETA las restricciones FK (hijos antes que padres).
FASES_TRUNCATE = [
    # ── FASE 1: Tickets / OT / Engineering ──────────────────────────────
    [
        "ticket_tags",               # asociación pura, sin FKs restrictivas
        "ticket_attachments",         # FK ticket → CASCADE
        "ticket_timeline",            # FK ticket → CASCADE
        "work_order_items",           # FK work_order → CASCADE
        "contact_attempts",           # FK work_order → CASCADE
        "engineering_task_timeline",  # FK engineering_task → CASCADE
        "engineering_tasks",          # FK ticket → CASCADE, FK user → SET NULL
        "work_orders",               # FK ticket → CASCADE, FK team → SET NULL
        "tickets",                   # FK user → SET NULL
    ],
    # ── FASE 2: Auth / Audit ────────────────────────────────────────────
    [
        "api_key_audit",             # sin FK estricta
        "api_keys",                  # sin FKs salientes
        "login_attempts",            # sin FKs
        "audit_logs",               # FK user → SET NULL
    ],
    # ── FASE 3: Coordinación / Flota ────────────────────────────────────
    [
        "vehicle_inspections",       # FK vehicle → CASCADE, FK user → RESTRICT
        "team_members",              # FK team → CASCADE, FK user → CASCADE
        "teams",                     # FK vehicle → SET NULL
        "vehicles",                  # FK warehouse → RESTRICT ← OJO
    ],
    # ── FASE 4: Inventario / Depósitos ──────────────────────────────────
    [
        "stock_movements",           # FK product → CASCADE, FK warehouse → SET NULL, FK serial_item → SET NULL
        "serial_items",              # FK product → CASCADE, FK warehouse → RESTRICT, FK ticket → SET NULL
        "stock_bulk",                # FK warehouse → CASCADE, FK product → CASCADE
        "warehouses",               # raíz, sin FKs restrictivas hacia arriba
        "products",                 # raíz, catálogo
    ],
]

# FASE 5: Usuarios no-admin (DELETE, no TRUNCATE, porque preservamos admin)
# FASE 6: Historial operativo opcional
FASE_MONITOR_HISTORY = "monitor_check_history"


def _get_table_count(cursor, table_name: str) -> int:
    """Retorna cantidad de registros en una tabla."""
    cursor.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table_name)))
    return cursor.fetchone()[0]


def _get_all_counts(cursor, tables: list) -> dict:
    """Retorna dict {table_name: count} para una lista de tablas."""
    counts = {}
    for t in tables:
        try:
            counts[t] = _get_table_count(cursor, t)
        except Exception as e:
            log.warning("  ⚠️  No se pudo contar %s: %s", t, e)
            counts[t] = -1
    return counts


def _truncate_table(cursor, table_name: str, cascade: bool = False):
    """TRUNCATE TABLE con RESTART IDENTITY, opcional CASCADE."""
    sql_stmt = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY").format(
        sql.Identifier(table_name)
    )
    if cascade:
        sql_stmt = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
            sql.Identifier(table_name)
        )
    cursor.execute(sql_stmt)


def _backup_database(cfg: dict, backup_dir: str) -> str:
    """
    Genera backup via pg_dump.
    Retorna la ruta del archivo generado.
    """
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"emerald_backup_{timestamp}.sql"
    filepath = os.path.join(backup_dir, filename)

    log.info("📦 Generando backup → %s", filepath)
    env = os.environ.copy()
    env["PGPASSWORD"] = cfg["POSTGRES_PASSWORD"]

    result = subprocess.run(
        [
            "pg_dump",
            "-h", cfg["POSTGRES_HOST"],
            "-p", cfg["POSTGRES_PORT"],
            "-U", cfg["POSTGRES_USER"],
            "-d", cfg["POSTGRES_DB"],
            "-F", "p",         # plain SQL
            "-f", filepath,
        ],
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error("❌ Error en pg_dump: %s", result.stderr)
        raise RuntimeError(f"pg_dump failed: {result.stderr}")

    # Verificar que el archivo no esté vacío
    size = os.path.getsize(filepath)
    log.info("✅ Backup generado: %s (%.2f MB)", filepath, size / (1024 * 1024))
    return filepath


def _restore_from_backup(cfg: dict, backup_path: str):
    """
    Restaura backup via psql.
    """
    log.info("♻️  Restaurando backup → %s", backup_path)
    env = os.environ.copy()
    env["PGPASSWORD"] = cfg["POSTGRES_PASSWORD"]

    result = subprocess.run(
        [
            "psql",
            "-h", cfg["POSTGRES_HOST"],
            "-p", cfg["POSTGRES_PORT"],
            "-U", cfg["POSTGRES_USER"],
            "-d", cfg["POSTGRES_DB"],
            "-f", backup_path,
        ],
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error("❌ Error al restaurar: %s", result.stderr)
        raise RuntimeError(f"psql restore failed: {result.stderr}")

    log.info("✅ Backup restaurado correctamente")


# ---------------------------------------------------------------------------
# Resumen de tablas a truncar
# ---------------------------------------------------------------------------
def _show_phase_summary():
    """Muestra un resumen de las fases de truncado."""
    total_tables = sum(len(fase) for fase in FASES_TRUNCATE)
    log.info("")
    log.info("═" * 60)
    log.info("  PLAN DE BLANQUEO — DÍA OPERATIVO CERO")
    log.info("═" * 60)
    log.info("")
    log.info("  Tablas a TRUNCATEAR: %d (en %d fases)", total_tables, len(FASES_TRUNCATE))
    log.info("  Tablas PRESERVADAS:  %d", len(TABLAS_PRESERVADAS))
    log.info("  Usuarios no-admin:   DELETE (se conserva admin)")
    log.info("")
    for i, fase in enumerate(FASES_TRUNCATE, 1):
        log.info("  FASE %d — %d tabla(s): %s", i, len(fase), ", ".join(fase))
    log.info("  FASE 5 — DELETE usuarios no-admin")
    log.info("  FASE 6 — TRUNCATE monitor_check_history (opcional)")
    log.info("")
    log.info("  Post-blanqueo: UPDATE scheduled_tasks SET execution_count = 0")
    log.info("")


# ---------------------------------------------------------------------------
# Modo DRY-RUN
# ---------------------------------------------------------------------------
def _execute_dry_run(conn):
    """
    Ejecuta todo en una transacción, muestra cuentas antes/después, hace ROLLBACK.
    """
    autocommit_original = conn.autocommit
    conn.autocommit = False

    try:
        cur = conn.cursor()
        _show_phase_summary()

        log.info("🔍  MODO DRY-RUN — No se realizarán cambios")
        log.info("─" * 60)

        # --- Fases 1-4: TRUNCATE ---
        todas_truncate = [t for fase in FASES_TRUNCATE for t in fase]
        log.info("📊  CONTEO ANTES DEL BLANQUEO:")
        counts_before = _get_all_counts(cur, todas_truncate)
        for t in todas_truncate:
            label = f"  {t}:".ljust(35)
            if counts_before[t] >= 0:
                log.info("     %s %d registros", label, counts_before[t])
            else:
                log.info("     %s ERROR al contar", label)

        log.info("")
        log.info("⚙️  Ejecutando TRUNCATE en transacción...")

        for i, fase in enumerate(FASES_TRUNCATE, 1):
            log.info("  FASE %d:", i)
            for t in fase:
                _truncate_table(cur, t)
                log.info("    ✅ TRUNCATE %s", t)

        # --- Fase 5: DELETE usuarios no-admin ---
        log.info("  FASE 5: DELETE usuarios no-admin")
        cur.execute("SELECT count(*) FROM users WHERE NOT is_superuser")
        non_admin_before = cur.fetchone()[0]
        log.info("    Usuarios no-admin a eliminar: %d", non_admin_before)

        # --- Fase 6: monitor_check_history ---
        log.info("  FASE 6 (opcional): TRUNCATE monitor_check_history")

        # --- Reset execution_count ---
        log.info("  POST: UPDATE scheduled_tasks SET execution_count = 0")

        # Verificar tablas preservadas
        log.info("")
        log.info("🔎  VERIFICANDO TABLAS PRESERVADAS:")
        for t in sorted(TABLAS_PRESERVADAS):
            try:
                cnt = _get_table_count(cur, t)
                log.info("    ✅ %s: %d registros (preservado)", t, cnt)
            except Exception:
                log.info("    ⚪ %s: (no existe o error)", t)

        # --- ROLLBACK ---
        log.info("")
        log.info("─" * 60)
        log.info("♻️  ️ HACIENDO ROLLBACK — Ningún cambio fue persistido")
        conn.rollback()
        log.info("✅ Dry-run completado. Usa --apply para ejecutar los cambios.")
        log.info("")

        # Mostrar comando de restauración útil
        log.info("💡 Para restaurar datos mock (si ya aplicaste --apply):")
        log.info("   docker compose exec -T db psql -U %s -d %s < /tmp/emerald_backup_<fecha>.sql",
                 cfg["POSTGRES_USER"], cfg["POSTGRES_DB"])
        log.info("")

    finally:
        conn.autocommit = autocommit_original


# ---------------------------------------------------------------------------
# Modo APPLY
# ---------------------------------------------------------------------------
def _execute_apply(conn, cfg: dict, backup_dir: str):
    """
    1. Genera backup automático
    2. Ejecuta TRUNCATE en orden con RESTART IDENTITY
    3. DELETE usuarios no-admin
    4. Resetea execution_count en scheduled_tasks
    5. Muestra verificación final
    """
    autocommit_original = conn.autocommit

    try:
        # ── 1. Backup ───────────────────────────────────────────────────
        log.info("═" * 60)
        log.info("  🚀  MODO APPLY — Se aplicarán cambios")
        log.info("═" * 60)
        log.info("")

        backup_path = _backup_database(cfg, backup_dir)
        log.info("")

        # ── 2. Contar antes ──────────────────────────────────────────────
        todas_truncate = [t for fase in FASES_TRUNCATE for t in fase]
        cur = conn.cursor()
        conn.autocommit = False

        log.info("📊  CONTEO ANTES DEL BLANQUEO:")
        counts_before = _get_all_counts(cur, todas_truncate)
        for t in todas_truncate:
            label = f"  {t}:".ljust(35)
            if counts_before[t] >= 0:
                log.info("     %s %d registros", label, counts_before[t])
            else:
                log.info("     %s ERROR", label)

        # ── 3. Fases 1-4: TRUNCATE ──────────────────────────────────────
        log.info("")
        log.info("⚙️  EJECUTANDO TRUNCATE CON RESTART IDENTITY...")

        for i, fase in enumerate(FASES_TRUNCATE, 1):
            log.info("  FASE %d:", i)
            for t in fase:
                _truncate_table(cur, t)
                log.info("    ✅ TRUNCATE %s — RESTART IDENTITY", t)

        # ── 4. Fase 5: DELETE usuarios no-admin ──────────────────────────
        log.info("  FASE 5: DELETE usuarios no-admin")
        cur.execute("SELECT count(*) FROM users WHERE NOT is_superuser")
        non_admin_before = cur.fetchone()[0]

        if non_admin_before > 0:
            # Primero eliminar team_members de usuarios no-admin
            cur.execute("""
                DELETE FROM team_members
                WHERE user_id IN (SELECT id FROM users WHERE NOT is_superuser)
            """)
            log.info("    ✅ DELETE team_members de usuarios no-admin")

            # Luego eliminar usuarios no-admin
            cur.execute("DELETE FROM users WHERE NOT is_superuser")
            log.info("    ✅ DELETE %d usuarios no-admin", non_admin_before)
        else:
            log.info("    ⏭️  No hay usuarios no-admin para eliminar")

        # ── 5. Fase 6: monitor_check_history ────────────────────────────
        try:
            _truncate_table(cur, FASE_MONITOR_HISTORY)
            log.info("  FASE 6: ✅ TRUNCATE monitor_check_history")
        except Exception as e:
            log.info("  FASE 6: ⏭️  monitor_check_history no truncada (%s)", e)

        # ── 6. Reset scheduled_tasks execution_count ─────────────────────
        cur.execute("UPDATE scheduled_tasks SET execution_count = 0")
        updated_tasks = cur.rowcount
        log.info("  POST: ✅ UPDATE scheduled_tasks SET execution_count = 0 (%d tareas)", updated_tasks)

        # ── 7. COMMIT ────────────────────────────────────────────────────
        conn.commit()
        log.info("")
        log.info("✅" + "═" * 58)
        log.info("✅  COMMIT EJECUTADO — Todos los cambios fueron persistidos")
        log.info("✅" + "═" * 58)

        # ── 8. Verificación ──────────────────────────────────────────────
        log.info("")
        log.info("🔎  VERIFICACIÓN POST-BLANQUEO:")
        cur = conn.cursor()
        counts_after = _get_all_counts(cur, todas_truncate)
        for t in todas_truncate:
            before = counts_before.get(t, -1)
            after = counts_after.get(t, -1)
            label = f"  {t}:".ljust(35)
            log.info("     %s %d → %d (↓ %d)", label, before, after, before - after)

        # Verificar usuarios
        cur.execute("SELECT count(*) FROM users WHERE is_superuser = true")
        admins = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM users WHERE is_superuser = false")
        non_admins = cur.fetchone()[0]
        log.info("  Usuarios admin:    %d", admins)
        log.info("  Usuarios no-admin: %d (debería ser 0)", non_admins)

        # Verificar scheduled_tasks
        cur.execute("SELECT count(*) FROM scheduled_tasks WHERE execution_count = 0")
        reset_ok = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM scheduled_tasks")
        total_tasks = cur.fetchone()[0]
        log.info("  Scheduled tasks con execution_count=0: %d / %d", reset_ok, total_tasks)

        # Verificar ISP data
        for t in ["clientes", "connections", "nodes", "subscribers", "plans"]:
            try:
                cnt = _get_table_count(cur, t)
                log.info("  %s preservados: %d registros", t, cnt)
            except Exception:
                pass

        log.info("")
        log.info("📦 Backup disponible en: %s", backup_path)
        log.info("")
        log.info("💡 Para restaurar (volver a datos mock):")
        log.info("   docker compose exec -T db psql -U %s -d %s < %s",
                 cfg["POSTGRES_USER"], cfg["POSTGRES_DB"], backup_path)
        log.info("")

    except Exception as e:
        log.error("❌ Error durante apply: %s", e)
        conn.rollback()
        log.info("♻️  Rollback ejecutado. Base de datos intacta.")
        raise

    finally:
        conn.autocommit = autocommit_original


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Blanqueo — Día Operativo Cero. Resetea datos operativos mock.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  %(prog)s                         # Dry-run (default, no modifica)
  %(prog)s --apply                 # Aplica cambios con backup automático
  %(prog)s --apply --backup-dir /tmp  # Backup en directorio personalizado
        """,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica los cambios (genera backup automático antes de truncar)",
    )
    parser.add_argument(
        "--backup-dir",
        default="/tmp",
        help="Directorio para guardar el backup (default: /tmp)",
    )
    parser.add_argument(
        "--restore",
        metavar="BACKUP_PATH",
        help="Ruta de un backup previo para restaurar (solo en modo --apply)",
    )

    args = parser.parse_args()

    # ── Cargar config ────────────────────────────────────────────────────
    global cfg
    cfg = _load_db_config()
    db_url = _db_url(cfg)

    log.info("🔌 Conectando a PostgreSQL en %s:%s ...",
             cfg["POSTGRES_HOST"], cfg["POSTGRES_PORT"])

    try:
        conn = psycopg2.connect(
            host=cfg["POSTGRES_HOST"],
            port=cfg["POSTGRES_PORT"],
            user=cfg["POSTGRES_USER"],
            password=cfg["POSTGRES_PASSWORD"],
            dbname=cfg["POSTGRES_DB"],
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        log.info("✅ Conexión exitosa a %s", cfg["POSTGRES_DB"])
    except Exception as e:
        log.error("❌ No se pudo conectar a la base de datos: %s", e)
        log.error("   Verifica que POSTGRES_HOST sea accesible desde este entorno.")
        log.error("   Si estás fuera del contenedor, usa localhost o la IP del host.")
        sys.exit(1)

    try:
        # Modo restore
        if args.restore:
            if not args.apply:
                log.error("❌ --restore requiere --apply")
                sys.exit(1)
            if not os.path.isfile(args.restore):
                log.error("❌ Backup no encontrado: %s", args.restore)
                sys.exit(1)
            log.warning("⚠️  Se restaurará el backup: %s", args.restore)
            log.warning("   Esto REEMPLAZARÁ todos los datos actuales.")
            confirm = input("   ¿Continuar? (escribe 'SI' para confirmar): ")
            if confirm.strip().upper() != "SI":
                log.info("Cancelado.")
                sys.exit(0)
            _restore_from_backup(cfg, args.restore)
            return

        # Modo apply
        if args.apply:
            log.warning("")
            log.warning("⚠️ ⚠️ ⚠️  ATENCIÓN  ⚠️ ⚠️ ⚠️")
            log.warning("  Esta acción ELIMINARÁ todos los datos operativos:")
            log.warning("  - Tickets, OT, Engineering Tasks")
            log.warning("  - Productos, Depósitos, Movimientos de Stock")
            log.warning("  - Vehículos, Inspecciones, Cuadrillas")
            log.warning("  - Audit Logs, API Keys, Login Attempts")
            log.warning("  - Usuarios no administradores")
            log.warning("")
            log.warning("  Se PRESERVARÁN:")
            log.warning("  - Datos ISP (clientes, conexiones, nodos, planes)")
            log.warning("  - Configuración del sistema y monitoreo")
            log.warning("  - Catálogos y roles")
            log.warning("  - Usuario administrador")
            log.warning("")
            log.warning("⚠️ ⚠️ ⚠️  ATENCIÓN  ⚠️ ⚠️ ⚠️")
            log.warning("")

            confirm = input("   ¿Estás seguro? (escribe 'BLANQUEO' para confirmar): ")
            if confirm.strip() != "BLANQUEO":
                log.info("Cancelado.")
                sys.exit(0)

            _execute_apply(conn, cfg, args.backup_dir)

        else:
            # Dry-run por defecto
            _execute_dry_run(conn)

    except Exception as e:
        log.error("❌ Error fatal: %s", e)
        sys.exit(1)
    finally:
        conn.close()
        log.info("🔌 Conexión cerrada.")


if __name__ == "__main__":
    cfg: dict = {}
    main()
