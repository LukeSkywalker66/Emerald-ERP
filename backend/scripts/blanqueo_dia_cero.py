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
  - Usuario admin (is_superuser = True)

Modos de ejecución:
  --dry-run   (default) Ejecuta en transacción, muestra cuentas, hace ROLLBACK
  --apply     Genera backup automático vía pg_dump, TRUNCATE con RESTART IDENTITY
              CASCADE, DELETE usuarios no-admin, resetea execution_count

Uso:
  # Dry-run (seguro, no modifica nada)
  python scripts/blanqueo_dia_cero.py

  # Aplicar cambios
  python scripts/blanqueo_dia_cero.py --apply

  # Especificar backup dir
  python scripts/blanqueo_dia_cero.py --apply --backup-dir /tmp

Requisitos:
  - Ejecutar desde dentro del container backend (WORKDIR /app)
  - PostgreSQL client (pg_dump, psql) disponible en el PATH
"""

import argparse
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Tuple

# ── Agregar backend root al sys.path para imports absolutos ──────────────
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.database import SessionLocal, engine

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
# Constantes
# ---------------------------------------------------------------------------

# Tablas de datos ISP / catálogos que NO se tocan
TABLAS_PRESERVADAS: frozenset = frozenset({
    # ISP
    "subscribers",
    "nodes",
    "plans",
    "connections",
    "clientes",
    "clientes_emails",
    "clientes_telefonos",
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

# Orden de TRUNCATE con RESTART IDENTITY CASCADE (6 fases).
# El orden RESPETA las restricciones FK (hijos antes que padres).
# Cada TRUNCATE usa CASCADE para manejar automáticamente FKs hijas no listadas.
FASES_TRUNCATE: List[List[str]] = [
    # ── FASE 1: Tickets / OT / Engineering ──────────────────────────────
    [
        "ticket_tags",
        "ticket_attachments",
        "ticket_timeline",
        "work_order_items",
        "contact_attempts",
        "engineering_task_timeline",
        "engineering_tasks",
        "work_orders",
        "tickets",
    ],
    # ── FASE 2: Auth / Audit ────────────────────────────────────────────
    [
        "api_key_audit",
        "api_keys",
        "login_attempts",
        "audit_logs",
    ],
    # ── FASE 3: Coordinación / Flota ────────────────────────────────────
    [
        "vehicle_inspections",
        "team_members",
        "teams",
        "vehicles",
    ],
    # ── FASE 4: Inventario / Depósitos ──────────────────────────────────
    [
        "stock_movements",
        "serial_items",
        "stock_bulk",
        "warehouses",
        "products",
    ],
]

# FASE 5: Usuarios no-admin (DELETE, no TRUNCATE — preservamos admin)
# FASE 6: Historial operativo opcional
FASE_MONITOR_HISTORY = "monitor_check_history"

# Backup
BACKUP_FILENAME_TEMPLATE = "emerald_pre_blanqueo_{timestamp}.sql"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_table_count(session: Session, table_name: str) -> int:
    """Retorna cantidad de registros en una tabla."""
    result = session.execute(
        text(f"SELECT count(*) FROM {table_name}")
    )
    return result.scalar()


def _get_all_counts(session: Session, tables: List[str]) -> dict:
    """Retorna dict {table_name: count} para una lista de tablas."""
    counts: dict = {}
    for t in tables:
        try:
            counts[t] = _get_table_count(session, t)
        except Exception as e:
            log.warning("  ⚠️  No se pudo contar %s: %s", t, e)
            counts[t] = -1
    return counts


def _truncate_table(session: Session, table_name: str) -> None:
    """TRUNCATE TABLE con RESTART IDENTITY CASCADE."""
    session.execute(
        text(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
    )


# ---------------------------------------------------------------------------
# Backup / Restore
# ---------------------------------------------------------------------------

def _pg_dump_args() -> List[str]:
    """Construye args para pg_dump usando la URL de SQLAlchemy."""
    # engine.url: postgresql://user:pass@host:port/dbname
    url = engine.url
    return [
        "pg_dump",
        "-h", url.host or "localhost",
        "-p", str(url.port or 5432),
        "-U", url.username or "",
        "-d", url.database or "",
        "-F", "p",  # plain SQL format
    ]


def _psql_restore_args() -> List[str]:
    """Construye args para psql usando la URL de SQLAlchemy."""
    url = engine.url
    return [
        "psql",
        "-h", url.host or "localhost",
        "-p", str(url.port or 5432),
        "-U", url.username or "",
        "-d", url.database or "",
    ]


def _get_pg_env() -> dict:
    """Entorno con PGPASSWORD para pg_dump/psql."""
    env = os.environ.copy()
    if engine.url.password:
        env["PGPASSWORD"] = engine.url.password
    return env


def backup_database(backup_dir: str) -> str:
    """
    Genera backup via pg_dump.
    Retorna la ruta del archivo generado.
    Frena la ejecución si falla.
    """
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = BACKUP_FILENAME_TEMPLATE.format(timestamp=timestamp)
    filepath = os.path.join(backup_dir, filename)

    log.info("📦 Generando backup → %s", filepath)

    result = subprocess.run(
        [*_pg_dump_args(), "-f", filepath],
        env=_get_pg_env(),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error("❌ Error en pg_dump: %s", result.stderr)
        raise RuntimeError(
            f"❌ Falló el backup automático. "
            f"Ejecutá pg_dump manualmente antes de continuar.\n"
            f"Detalle: {result.stderr}"
        )

    size = os.path.getsize(filepath)
    log.info("✅ Backup generado: %s (%.2f MB)", filepath, size / (1024 * 1024))
    return filepath


def restore_from_backup(backup_path: str) -> None:
    """Restaura backup via psql."""
    log.info("♻️  Restaurando backup → %s", backup_path)

    result = subprocess.run(
        [*_psql_restore_args(), "-f", backup_path],
        env=_get_pg_env(),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error("❌ Error al restaurar: %s", result.stderr)
        raise RuntimeError(f"psql restore failed: {result.stderr}")

    log.info("✅ Backup restaurado correctamente")


# ---------------------------------------------------------------------------
# Resumen de fases
# ---------------------------------------------------------------------------

def _show_phase_summary() -> None:
    """Muestra un resumen de las fases de truncado."""
    total_tables = sum(len(fase) for fase in FASES_TRUNCATE)
    log.info("")
    log.info("═" * 60)
    log.info("  🌆  PLAN DE BLANQUEO — DÍA OPERATIVO CERO")
    log.info("═" * 60)
    log.info("")
    log.info("  🗑️  Tablas a TRUNCATEAR:  %d (en %d fases)",
             total_tables, len(FASES_TRUNCATE))
    log.info("  💾 Tablas PRESERVADAS:   %d", len(TABLAS_PRESERVADAS))
    log.info("  👥 Usuarios no-admin:    DELETE (se conserva admin)")
    log.info("")
    for i, fase in enumerate(FASES_TRUNCATE, 1):
        log.info("  📍 FASE %d — %d tabla(s): %s", i, len(fase), ", ".join(fase))
    log.info("  📍 FASE 5 — DELETE usuarios no-admin pre-blanqueo")
    log.info("  📍 FASE 6 — TRUNCATE monitor_check_history (historial de monitoreo)")
    log.info("")
    log.info("  🔧 Post-blanqueo: UPDATE scheduled_tasks SET execution_count = 0")
    log.info("")


# ---------------------------------------------------------------------------
# Modo DRY-RUN
# ---------------------------------------------------------------------------

def _execute_dry_run(session: Session) -> None:
    """
    Ejecuta todo en una transacción, muestra cuentas antes/después, hace ROLLBACK.
    """
    _show_phase_summary()

    log.info("🔍  MODO DRY-RUN — No se realizarán cambios")
    log.info("─" * 60)

    todas_truncate = [t for fase in FASES_TRUNCATE for t in fase]

    # ── Conteo antes ────────────────────────────────────────────────────
    log.info("📊  CONTEO ANTES DEL BLANQUEO:")
    counts_before = _get_all_counts(session, todas_truncate)
    for t in todas_truncate:
        label = f"  {t}:".ljust(35)
        if counts_before[t] >= 0:
            log.info("     %s %d registros", label, counts_before[t])
        else:
            log.info("     %s ERROR al contar", label)

    # ── Ejecutar TRUNCATE en transacción ────────────────────────────────
    log.info("")
    log.info("⚙️  Ejecutando TRUNCATE en transacción (no persistida)...")

    for i, fase in enumerate(FASES_TRUNCATE, 1):
        log.info("  📍 FASE %d:", i)
        for t in fase:
            _truncate_table(session, t)
            log.info("    ✅ TRUNCATE %s — RESTART IDENTITY CASCADE", t)

    # ── Fase 5: DELETE ──────────────────────────────────────────────────
    log.info("  📍 FASE 5: DELETE usuarios no-admin")
    non_admin_count = _get_table_count(session, "users") - \
        _get_table_count(session, "users WHERE is_superuser = True")
    # More robust approach:
    result = session.execute(text("SELECT count(*) FROM users WHERE NOT is_superuser"))
    non_admin_before = result.scalar()
    log.info("    Usuarios no-admin a eliminar: %d", non_admin_before)

    # ── Fase 6 ──────────────────────────────────────────────────────────
    log.info("  📍 FASE 6: TRUNCATE monitor_check_history")

    # ── Reset execution_count ───────────────────────────────────────────
    log.info("  🔧 POST: UPDATE scheduled_tasks SET execution_count = 0")

    # ── Verificar tablas preservadas ────────────────────────────────────
    log.info("")
    log.info("🔎  VERIFICANDO TABLAS PRESERVADAS:")
    for t in sorted(TABLAS_PRESERVADAS):
        try:
            cnt = _get_table_count(session, t)
            log.info("    ✅ %s: %d registros (preservado)", t, cnt)
        except Exception as e:
            log.info("    ⚪ %s: %s", t, e)
            # No abortar la transacción por un error de consulta
            session.rollback()

    # ── ROLLBACK ────────────────────────────────────────────────────────
    log.info("")
    log.info("─" * 60)
    log.info("♻️  ️ HACIENDO ROLLBACK — Ningún dato fue alterado.")
    log.info("   Los comandos se ejecutaron dentro de una transacción")
    log.info("   que fue descartada. La base de datos está intacta.")
    session.rollback()
    log.info("")
    log.info("✅ Dry-run completado exitosamente.")
    log.info("💡 Ejecutá con --apply para aplicar los cambios reales.")
    log.info("")


# ---------------------------------------------------------------------------
# Modo APPLY
# ---------------------------------------------------------------------------

def _execute_apply(session: Session, backup_dir: str) -> None:
    """
    1. Genera backup automático
    2. Ejecuta TRUNCATE en orden con RESTART IDENTITY CASCADE
    3. DELETE usuarios no-admin
    4. Resetea execution_count en scheduled_tasks
    5. Muestra verificación final con banner de stock
    """
    # ── 1. Backup ───────────────────────────────────────────────────────
    log.info("═" * 60)
    log.info("  🚀  MODO APPLY — Se aplicarán cambios permanentes")
    log.info("═" * 60)
    log.info("")

    backup_path = backup_database(backup_dir)
    log.info("")

    todas_truncate = [t for fase in FASES_TRUNCATE for t in fase]

    # ── 2. Contar antes ─────────────────────────────────────────────────
    log.info("📊  CONTEO ANTES DEL BLANQUEO:")
    counts_before = _get_all_counts(session, todas_truncate)
    for t in todas_truncate:
        label = f"  {t}:".ljust(35)
        if counts_before[t] >= 0:
            log.info("     %s %d registros", label, counts_before[t])
        else:
            log.info("     %s ERROR", label)

    # ── 3. Fases 1-4: TRUNCATE ─────────────────────────────────────────
    log.info("")
    log.info("⚙️  EJECUTANDO TRUNCATE CON RESTART IDENTITY CASCADE...")

    for i, fase in enumerate(FASES_TRUNCATE, 1):
        log.info("  📍 FASE %d:", i)
        for t in fase:
            _truncate_table(session, t)
            log.info("    ✅ TRUNCATE %s — RESTART IDENTITY CASCADE", t)

    # ── 4. Fase 5: DELETE usuarios no-admin ─────────────────────────────
    log.info("  📍 FASE 5: DELETE usuarios no-admin")
    result = session.execute(text("SELECT count(*) FROM users WHERE NOT is_superuser"))
    non_admin_before = result.scalar()

    if non_admin_before > 0:
        # Primero team_members de usuarios no-admin
        result = session.execute(text(
            "WITH deleted AS ("
            "  DELETE FROM team_members "
            "  WHERE user_id IN (SELECT id FROM users WHERE NOT is_superuser) "
            "  RETURNING 1"
            ") SELECT count(*) FROM deleted"
        ))
        members_count = result.scalar() or 0
        log.info("    ✅ DELETE %d team_members de usuarios no-admin", members_count)

        # Luego usuarios no-admin
        result = session.execute(text(
            "WITH deleted AS ("
            "  DELETE FROM users WHERE NOT is_superuser RETURNING 1"
            ") SELECT count(*) FROM deleted"
        ))
        deleted_users = result.scalar() or 0
        log.info("    ✅ DELETE %d usuarios no-admin", deleted_users)
    else:
        log.info("    ⏭️  No hay usuarios no-admin para eliminar")

    # ── 5. Fase 6: monitor_check_history ────────────────────────────────
    # Usar savepoint para aislar el error: si la tabla no existe,
    # solo se descarta el savepoint, no la transacción completa
    try:
        with session.begin_nested():
            _truncate_table(session, FASE_MONITOR_HISTORY)
        log.info("  📍 FASE 6: ✅ TRUNCATE monitor_check_history")
    except Exception as e:
        log.info("  📍 FASE 6: ⏭️  monitor_check_history no truncada (%s)", e)

    # ── 6. Reset scheduled_tasks execution_count ─────────────────────────
    result = session.execute(text("UPDATE scheduled_tasks SET execution_count = 0"))
    updated_tasks = result.rowcount
    log.info("  🔧 POST: ✅ UPDATE scheduled_tasks SET execution_count = 0 (%d tareas)",
             updated_tasks)

    # ── 7. COMMIT ───────────────────────────────────────────────────────
    session.commit()
    log.info("")
    log.info("✅" + "═" * 58)
    log.info("✅  ✅  BLANQUEO COMPLETADO  ✅  ✅")
    log.info("✅" + "═" * 58)
    log.info("")
    log.info("  🧹 Todas las tablas operativas fueron limpiadas.")
    log.info("  🆔 Secuencias de IDs reseteadas a 1.")
    log.info("  👤 Usuario administrador preservado.")
    log.info("  🌐 Datos ISP y catálogos intactos.")
    log.info("")
    log.info("  ⚠️  RECORDATORIO IMPORTANTE:")
    log.info("  El stock físico de inventario en pañoles/almacenes")
    log.info("  no se altera por SQL. Logística debe realizar el")
    log.info("  conteo manual inicial de stock_bulk y serial_items.")
    log.info("")

    # ── 8. Verificación post-blanqueo ───────────────────────────────────
    log.info("🔎  VERIFICACIÓN POST-BLANQUEO:")
    counts_after = _get_all_counts(session, todas_truncate)
    for t in todas_truncate:
        before = counts_before.get(t, -1)
        after = counts_after.get(t, -1)
        label = f"  {t}:".ljust(35)
        log.info("     %s %d → %d (↓ %d)", label, before, after, before - after)

    # Verificar usuarios
    admins = _get_table_count(session, "users WHERE is_superuser = True")
    non_admins = _get_table_count(session, "users WHERE is_superuser = False")
    log.info("  👤 Usuarios admin:    %d", admins)
    log.info("  👤 Usuarios no-admin: %d (debería ser 0)", non_admins)

    # Verificar scheduled_tasks
    reset_ok = _get_table_count(session, "scheduled_tasks WHERE execution_count = 0")
    total_tasks = _get_table_count(session, "scheduled_tasks")
    log.info("  🔧 Scheduled tasks con execution_count=0: %d / %d",
             reset_ok, total_tasks)

    # Verificar ISP data preservada
    for t in ["clientes", "connections", "nodes", "subscribers", "plans"]:
        try:
            cnt = _get_table_count(session, t)
            log.info("  🌐 %s preservados: %d registros", t, cnt)
        except Exception:
            pass

    log.info("")
    log.info("📦 Backup disponible en: %s", backup_path)
    log.info("")
    log.info("💡 Para restaurar (volver a datos mock o estado previo):")
    log.info("   cat %s | docker compose exec -T db psql -U %s -d %s",
             backup_path,
             engine.url.username or "emerald_owner",
             engine.url.database or "emerald_stock")
    log.info("")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Blanqueo — Día Operativo Cero. Resetea datos operativos mock.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  %(prog)s                              # Dry-run (default, no modifica nada)
  %(prog)s --apply                      # Aplica cambios con backup automático
  %(prog)s --apply --backup-dir /backup # Backup en directorio personalizado
        """,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        dest="apply",
        help="Aplica los cambios (genera backup automático antes de truncar)",
    )
    parser.add_argument(
        "--backup-dir",
        default="/tmp",
        dest="backup_dir",
        help="Directorio para guardar el backup (default: /tmp)",
    )
    parser.add_argument(
        "--restore",
        metavar="BACKUP_PATH",
        dest="restore",
        default=None,
        help="Ruta de un backup previo para restaurar (solo en modo --apply)",
    )

    args = parser.parse_args()

    # ── Conectar a la base de datos ──────────────────────────────────────
    log.info("🔌 Conectando a PostgreSQL ...")
    try:
        session: Session = SessionLocal()
        # Verificar conexión
        session.execute(text("SELECT 1"))
        url = engine.url
        log.info("✅ Conectado a %s@%s:%s/%s",
                 url.username, url.host, url.port, url.database)
    except Exception as e:
        log.error("❌ No se pudo conectar a la base de datos: %s", e)
        log.error("   Verificá que el container backend tenga acceso a la DB.")
        log.error("   Ejecutá este script desde: docker compose exec backend ...")
        sys.exit(1)

    try:
        # ── Modo restore ────────────────────────────────────────────────
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
            restore_from_backup(args.restore)
            return

        # ── Modo apply ──────────────────────────────────────────────────
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

            _execute_apply(session, args.backup_dir)

        else:
            # ── Dry-run por defecto ────────────────────────────────────
            _execute_dry_run(session)

    except Exception as e:
        log.error("❌ Error fatal: %s", e)
        session.rollback()
        sys.exit(1)
    finally:
        session.close()
        log.info("🔌 Conexión cerrada.")


if __name__ == "__main__":
    main()
