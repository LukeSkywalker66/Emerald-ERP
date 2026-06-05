#!/usr/bin/env python3
"""
Migración Legacy Hesk → Emerald ERP
=====================================
ETL script que parsea un dump SQL de Hesk (MySQL/MariaDB) y migra los tickets
al sistema Emerald (PostgreSQL) usando SQLAlchemy 2.0.

Estrategia "Modo Cápsula":
  - Cada fila de hesk_tickets → 1 Ticket (con estado "closed")
  - Cada ticket → 1 TicketTimeline con event_type="legacy_import"
  - Todo el contenido original (thread, datos cliente, metadatos) se empaqueta
    en el campo meta_data (JSONB) del timeline.

Uso:
  python scripts/migrate_legacy_tickets.py --dry-run          # Solo análisis
  python scripts/migrate_legacy_tickets.py --apply            # Ejecutar migración
  python scripts/migrate_legacy_tickets.py --apply --chunk-size 50
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from typing import Any, Generator, Optional

# ── Configurar sys.path para poder importar desde backend/src ──
# Estrategia: buscar src/ desde varias rutas posibles
_SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))
_CANDIDATES = [
    os.path.join(_SCRIPT_DIR, "..", "src"),                    # scripts/../src → /app/src
    os.path.join(_SCRIPT_DIR, "..", "backend", "src"),         # scripts/../backend/src
    os.path.join(os.getcwd(), "src"),                           # /app/src
]
for _p in _CANDIDATES:
    _p = os.path.abspath(_p)
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)
        break

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("MigrateHesk")

# ── Configuración ──
# Ruta del dump: junto al script en scripts/legacy_data/
_DUMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "legacy_data"))
DEFAULT_DUMP_PATH = os.path.join(_DUMP_DIR, "c0soporte.sql")
DEFAULT_CHUNK_SIZE = 100
DEFAULT_SAMPLES = 3

# ── Columnas de hesk_tickets en orden (según el dump) ──
HESK_TICKET_COLUMNS = [
    "id", "trackid", "name", "email", "category", "priority", "subject",
    "message", "message_html", "dt", "lastchange", "firstreply", "closedat",
    "articles", "ip", "language", "status", "openedby", "firstreplyby",
    "closedby", "replies", "staffreplies", "owner", "assignedby", "time_worked",
    "lastreplier", "replierid", "archive", "locked", "attachments", "merged",
    "history",
    # custom1 .. custom50
    "custom1", "custom2", "custom3", "custom4", "custom5", "custom6", "custom7",
    "custom8", "custom9", "custom10", "custom11", "custom12", "custom13",
    "custom14", "custom15", "custom16", "custom17", "custom18", "custom19",
    "custom20", "custom21", "custom22", "custom23", "custom24", "custom25",
    "custom26", "custom27", "custom28", "custom29", "custom30", "custom31",
    "custom32", "custom33", "custom34", "custom35", "custom36", "custom37",
    "custom38", "custom39", "custom40", "custom41", "custom42", "custom43",
    "custom44", "custom45", "custom46", "custom47", "custom48", "custom49",
    "custom50",
    "due_date", "overdue_email_sent", "satisfaction_email_sent",
    "satisfaction_email_dt",
]

HESK_REPLY_COLUMNS = [
    "id", "replyto", "name", "message", "message_html", "dt",
    "attachments", "staffid", "rating", "read",
]

# Mapeo de prioridad Hesk (enum '0','1','2','3') → Emerald
HESK_PRIORITY_MAP = {
    "0": "critical",
    "1": "high",
    "2": "medium",
    "3": "low",
}

# Keywords para inferir TicketType desde el subject
TICKET_TYPE_KEYWORDS: list[tuple[list[str], str]] = [
    (["INSTALACION", "ALTA NUEVA", "NUEVA INSTALACION", "ALTA TV", "ALTA FO"], "installation"),
    (["BAJA", "CANCELACION", "CANCELACIÓN", "DAR DE BAJA"], "withdrawal"),
    (["TRASLADO", "MUDANZA", "CAMBIO DE DOMICILIO"], "relocation"),
    (["SIN SERVICIO", "RECLAMO", "FALLA", "ROTO", "LENTITUD",
      "NO FUNCIONA", "CORTE", "INTERMITENCIA"], "technical"),
    (["ADMINISTRATIVO", "FACTURA", "CAMBITO DE TITULAR",
      "CAMBIO DE TITULAR", "CONSULTA"], "administrative"),
]

# Mapping de custom fields a nombres semánticos
CUSTOM_FIELD_MAP = {
    "custom1": ("address", "Domicilio"),
    "custom2": ("phone", "Teléfono"),
    "custom3": ("client_dni", "D.N.I."),
    "custom4": ("neighborhood", "Barrio"),
    "custom7": ("city", "Localidad"),
}


# ═════════════════════════════════════════════════════════════════════════════
#  PARSEADOR SQL LINE-BY-LINE
# ═════════════════════════════════════════════════════════════════════════════

def parse_sql_value(token: str) -> Any:
    """Convierte un token SQL a valor Python."""
    token = token.strip()
    if token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        # Desescapar comillas simples SQL
        inner = token[1:-1]
        inner = inner.replace("\\'", "'").replace("''", "'")
        return inner
    if token == "''":
        return ""
    # Intentar número
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return token


def tokenize_sql_tuple(line: str) -> list[str]:
    """
    Tokeniza una línea SQL como: (val1, 'str2', val3, ...)
    Retorna lista de strings con cada valor crudo (sin procesar).
    Maneja comillas escapadas, NULLs, números, y strings con comas.
    """
    line = line.strip()

    # Remover paréntesis envolventes
    if line.startswith("("):
        line = line[1:]
    # Remover trailing ), o ); o )
    if line.endswith("),"):
        line = line[:-2]
    elif line.endswith(");"):
        line = line[:-2]
    elif line.endswith(")"):
        line = line[:-1]

    tokens: list[str] = []
    current = []
    in_string = False
    i = 0

    while i < len(line):
        ch = line[i]

        if in_string:
            if ch == "'" and i + 1 < len(line) and line[i + 1] == "'":
                # Comilla escapada SQL (doble comilla)
                current.append("''")
                i += 2
                continue
            elif ch == "\\" and i + 1 < len(line) and line[i + 1] == "'":
                # Comilla escapada con backslash
                current.append("\\'")
                i += 2
                continue
            elif ch == "'":
                # Fin de string
                in_string = False
                current.append(ch)
                i += 1
                continue
            else:
                current.append(ch)
                i += 1
                continue
        else:
            if ch == "'":
                in_string = True
                current.append(ch)
                i += 1
                continue
            elif ch == ",":
                tokens.append("".join(current).strip())
                current = []
                i += 1
                continue
            elif ch == " " and not current:
                # Ignorar espacios al inicio del token
                i += 1
                continue
            else:
                current.append(ch)
                i += 1
                continue

    # Último token
    if current:
        tokens.append("".join(current).strip())

    return tokens


def parse_hesk_inserts(
    filepath: str,
    table_name: str,
    columns: list[str],
) -> Generator[dict[str, Any], None, None]:
    """
    Generador que parsea INSERTs del dump SQL línea por línea.
    Detecta `INSERT INTO <table_name>` y extrae los VALUES.
    Cada fila (tuple) se convierte en un dict {columna: valor}.

    El dump tiene filas single-line, lo que hace el parsing confiable.
    """
    insert_re = re.compile(
        rf"INSERT\s+INTO\s+`{re.escape(table_name)}`\s*"
        r"\(([^)]+)\)\s*VALUES",
        re.IGNORECASE,
    )

    current_columns: list[str] | None = None
    row_count = 0

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line_stripped = line.strip()

            # Detectar inicio de INSERT
            m = insert_re.search(line_stripped)
            if m:
                # Extraer column names del INSERT
                col_names_str = m.group(1)
                current_columns = [
                    c.strip().strip("`")
                    for c in col_names_str.split(",")
                ]
                # La línea puede tener VALUES en la misma línea
                # o continuar en la siguiente
                values_part = line_stripped[m.end():].strip()
                if values_part:
                    # Puede tener rows inmediatamente
                    # Procesar cada tuple en esta línea (después de VALUES)
                    pass
                continue

            # Si estamos dentro de un INSERT, procesar tuples
            if current_columns is not None and line_stripped.startswith("("):
                tokens = tokenize_sql_tuple(line_stripped)
                # Parsear valores
                parsed_values = [parse_sql_value(t) for t in tokens]
                # Mapear a columnas
                row_dict = {}
                for idx, col_name in enumerate(current_columns):
                    if idx < len(parsed_values):
                        row_dict[col_name] = parsed_values[idx]
                    else:
                        row_dict[col_name] = None
                row_count += 1
                yield row_dict

            # Detectar fin de INSERT
            if current_columns is not None and line_stripped.endswith(");"):
                current_columns = None


def parse_hesk_tickets(filepath: str) -> Generator[dict[str, Any], None, None]:
    """Generador de tickets desde el dump SQL."""
    yield from parse_hesk_inserts(filepath, "hesk_tickets", HESK_TICKET_COLUMNS)


def parse_hesk_replies(filepath: str) -> Generator[dict[str, Any], None, None]:
    """Generador de replies desde el dump SQL."""
    yield from parse_hesk_inserts(filepath, "hesk_replies", HESK_REPLY_COLUMNS)


# ═════════════════════════════════════════════════════════════════════════════
#  MAPPER: HESK → EMERALD
# ═════════════════════════════════════════════════════════════════════════════

def infer_ticket_type(subject: str) -> str:
    """Infiere el TicketType de Emerald basado en keywords del subject."""
    if not subject:
        return "technical"
    subject_upper = subject.upper().strip()
    for keywords, ticket_type in TICKET_TYPE_KEYWORDS:
        for kw in keywords:
            if kw in subject_upper:
                return ticket_type
    return "technical"


def map_priority(hesk_priority: Any) -> str:
    """Mapea prioridad Hesk (0-3) a Emerald (critical/high/medium/low)."""
    return HESK_PRIORITY_MAP.get(str(hesk_priority), "low")


def build_connection_details(row: dict) -> dict:
    """Construye connection_details JSONB desde custom fields."""
    details = {}
    for custom_key, (field_name, _label) in CUSTOM_FIELD_MAP.items():
        val = row.get(custom_key)
        if val and str(val).strip():
            details[field_name] = str(val).strip()
    # También incluir email y nombre del cliente
    if row.get("email") and str(row.get("email", "")).strip():
        details["email"] = str(row["email"]).strip()
    if row.get("name") and str(row.get("name", "")).strip():
        details["client_name"] = str(row["name"]).strip()
    return details if details else None


def build_thread(
    ticket_row: dict,
    replies: list[dict],
) -> list[dict]:
    """
    Construye el thread cronológico combinando el mensaje original
    + todas las replies ordenadas por dt ascendente.
    """
    thread: list[dict] = []

    # Mensaje original
    thread.append({
        "type": "original",
        "author": str(ticket_row.get("name", "")),
        "date": str(ticket_row.get("dt", "")),
        "body": str(ticket_row.get("message", "")),
    })

    # Replies ordenadas por dt
    sorted_replies = sorted(replies, key=lambda r: str(r.get("dt", "")))
    for reply in sorted_replies:
        thread.append({
            "type": "reply",
            "author": str(reply.get("name", "")),
            "date": str(reply.get("dt", "")),
            "body": str(reply.get("message", "")),
            "staff_id": reply.get("staffid"),
        })

    return thread


def build_ticket_fields(row: dict, replies: list[dict]) -> dict:
    """Construye los campos para crear un Ticket de Emerald."""
    from src.models.tickets import TicketStatus, TicketPriority, TicketType

    subject = str(row.get("subject", "")).strip() or "Ticket migrado (sin asunto)"
    description = str(row.get("message", "")) or None
    priority_str = map_priority(row.get("priority"))
    ticket_type_str = infer_ticket_type(subject)
    connection_details = build_connection_details(row)

    # Convertir strings a enums de SQLAlchemy
    try:
        priority = TicketPriority(priority_str)
    except ValueError:
        priority = TicketPriority.low
    try:
        ticket_type = TicketType(ticket_type_str)
    except ValueError:
        ticket_type = TicketType.technical

    fields = {
        "subject": subject,
        "description": description,
        "connection_details": connection_details,
        "status": TicketStatus.closed,
        "priority": priority,
        "ticket_type": ticket_type,
        # creator_id y assigned_to_id se dejan NULL
        # category_id se deja NULL (no hay mapping directo)
    }
    return fields


def build_timeline_fields(
    ticket_row: dict,
    replies: list[dict],
) -> dict:
    """Construye los campos para crear un TicketTimeline legacy_import."""
    thread = build_thread(ticket_row, replies)

    # Construir client_info
    client_info = {
        "name": str(ticket_row.get("name", "")),
        "email": str(ticket_row.get("email", "")),
    }
    for custom_key, (field_name, _label) in CUSTOM_FIELD_MAP.items():
        val = ticket_row.get(custom_key)
        if val and str(val).strip():
            client_info[field_name] = str(val).strip()

    meta_data = {
        "legacy_ticket_id": ticket_row.get("id"),
        "legacy_trackid": str(ticket_row.get("trackid", "")),
        "legacy_category": ticket_row.get("category"),
        "legacy_priority": ticket_row.get("priority"),
        "legacy_status": ticket_row.get("status"),
        "client_info": client_info,
        "thread": thread,
        "reply_count": ticket_row.get("replies", 0),
        "staff_reply_count": ticket_row.get("staffreplies", 0),
        "opened_by": ticket_row.get("openedby"),
        "closed_by": ticket_row.get("closedby"),
        "closed_at": str(ticket_row.get("closedat", "")) if ticket_row.get("closedat") else None,
        "time_worked": str(ticket_row.get("time_worked", "")),
        "ip": str(ticket_row.get("ip", "")),
        "history_html": str(ticket_row.get("history", "")),
        "legacy_attachments": str(ticket_row.get("attachments", "")),
        "due_date": str(ticket_row.get("due_date", "")) if ticket_row.get("due_date") else None,
    }

    # Limpiar valores None del meta_data para JSONB
    meta_data = {k: v for k, v in meta_data.items() if v is not None}

    return {
        "event_type": "legacy_import",
        "content": f"Ticket migrado desde sistema legacy (Hesk, ID original: {ticket_row.get('id')}, TrackID: {ticket_row.get('trackid', 'N/A')})",
        "meta_data": meta_data,
        # author_id se deja NULL (migración automática)
    }


# ═════════════════════════════════════════════════════════════════════════════
#  PROCESAMIENTO POR LOTES (CHUNKED BATCH)
# ═════════════════════════════════════════════════════════════════════════════

def check_already_migrated(db_session, legacy_id: int) -> bool:
    """
    Verifica si un ticket legacy ya fue migrado.
    Busca en ticket_timeline un meta_data->>'legacy_ticket_id' = legacy_id.
    """
    from sqlalchemy import text
    sql = text(
        "SELECT COUNT(*) FROM ticket_timeline "
        "WHERE event_type = 'legacy_import' "
        "AND meta_data->>'legacy_ticket_id' = :legacy_id"
    )
    result = db_session.execute(sql, {"legacy_id": str(legacy_id)})
    count = result.scalar()
    return count > 0


def process_chunk(
    db_session,
    chunk_data: list[tuple[dict, list[dict]]],
    chunk_index: int,
    chunk_size: int,
) -> dict:
    """
    Procesa un chunk de tickets.
    Cada elemento es (ticket_row, replies_list).

    Retorna dict con resultado del chunk.
    """
    from src.models.tickets import Ticket, TicketTimeline

    tickets_to_insert: list[Ticket] = []
    timelines_to_insert: list[TicketTimeline] = []
    skipped = 0
    errors: list[str] = []

    for ticket_row, replies in chunk_data:
        try:
            legacy_id = ticket_row.get("id")

            # Verificar duplicados
            if check_already_migrated(db_session, legacy_id):
                logger.debug(f"  ↪ Ticket #{legacy_id} ya migrado, saltando")
                skipped += 1
                continue

            # Construir objetos
            ticket_fields = build_ticket_fields(ticket_row, replies)
            ticket = Ticket(**ticket_fields)

            timeline_fields = build_timeline_fields(ticket_row, replies)
            timeline = TicketTimeline(
                ticket=ticket,  # relationship: SQLAlchemy asigna ticket_id
                **timeline_fields,
            )

            tickets_to_insert.append(ticket)
            timelines_to_insert.append(timeline)

        except Exception as e:
            err_msg = f"Error construyendo ticket #{ticket_row.get('id')}: {e}"
            logger.error(f"  ✗ {err_msg}")
            errors.append(err_msg)

    if not tickets_to_insert:
        return {
            "ok": True,
            "inserted": 0,
            "skipped": skipped,
            "errors": errors,
        }

    try:
        # Primero agregar tickets para que tengan IDs generados
        db_session.add_all(tickets_to_insert)
        db_session.flush()  # Genera IDs

        # Ahora asignar ticket_id a los timelines
        for timeline in timelines_to_insert:
            # El timeline ya tiene la relación con ticket
            pass

        db_session.add_all(timelines_to_insert)
        db_session.commit()

        logger.info(
            f"  ✓ Chunk {chunk_index}: {len(tickets_to_insert)} insertados, "
            f"{skipped} saltados"
        )
        return {
            "ok": True,
            "inserted": len(tickets_to_insert),
            "skipped": skipped,
            "errors": errors,
        }

    except Exception as e:
        db_session.rollback()
        err_msg = f"Error en chunk {chunk_index}: {e}"
        logger.error(f"  ✗ {err_msg}")
        return {
            "ok": False,
            "inserted": 0,
            "skipped": skipped,
            "errors": [err_msg],
        }


# ═════════════════════════════════════════════════════════════════════════════
#  DRY-RUN: MOSTRAR SAMPLES
# ═════════════════════════════════════════════════════════════════════════════

def show_dry_run_samples(
    ticket_rows: list[dict],
    replies_by_ticket: dict[int, list[dict]],
    samples: int,
):
    """Muestra ejemplos del JSONB que se generará."""
    print(f"\n{'='*70}")
    print("  MUESTRAS DE meta_data GENERADO")
    print(f"{'='*70}\n")

    for i, row in enumerate(ticket_rows[:samples]):
        legacy_id = row.get("id")
        replies = replies_by_ticket.get(legacy_id, [])

        ticket_fields = build_ticket_fields(row, replies)
        timeline_fields = build_timeline_fields(row, replies)

        print(f"--- Ticket #{legacy_id} (TrackID: {row.get('trackid')}) ---")
        print(f"  Subject:        {row.get('subject')}")
        print(f"  Tipo inferido:  {ticket_fields['ticket_type']}")
        print(f"  Prioridad map:  {ticket_fields['priority']}")
        print(f"  Status:         {ticket_fields['status']}")
        print(f"  Thread:         1 original + {len(replies)} replies")
        print(f"\n  connection_details:")
        print(json.dumps(ticket_fields.get("connection_details"), indent=4, ensure_ascii=False))
        print(f"\n  meta_data (abreviado, thread truncado):")
        md = dict(timeline_fields["meta_data"])
        md["thread"] = [
            {k: (v[:80] + "..." if isinstance(v, str) and len(v) > 80 else v)
             for k, v in msg.items()}
            for msg in md.get("thread", [])
        ]
        print(json.dumps(md, indent=4, ensure_ascii=False))
        print()

    print(f"{'='*70}")
    print(f"  Total tickets en dump: {len(ticket_rows)}")
    print(f"  Total replies en dump: {sum(len(v) for v in replies_by_ticket.values())}")
    print(f"  Tickets con replies:   {sum(1 for v in replies_by_ticket.values() if v)}")
    print(f"{'='*70}\n")


# ═════════════════════════════════════════════════════════════════════════════
#  CARGA DE REPLIES EN MEMORIA
# ═════════════════════════════════════════════════════════════════════════════

def load_replies(filepath: str) -> dict[int, list[dict]]:
    """
    Carga todas las replies del dump en un dict {replyto: [replies]}.
    Esto se hace en memoria porque las replies son menos que los tickets.
    (típicamente ~3 replies por ticket)
    """
    replies_by_ticket: dict[int, list[dict]] = {}
    count = 0

    logger.info("Cargando replies desde dump...")
    for reply in parse_hesk_replies(filepath):
        replyto = reply.get("replyto")
        if replyto is not None:
            replyto = int(replyto)
            if replyto not in replies_by_ticket:
                replies_by_ticket[replyto] = []
            replies_by_ticket[replyto].append(reply)
            count += 1

    logger.info(f"  → {count} replies cargadas para {len(replies_by_ticket)} tickets")
    return replies_by_ticket


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrar tickets legacy Hesk → Emerald ERP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python scripts/migrate_legacy_tickets.py --dry-run
  python scripts/migrate_legacy_tickets.py --apply
  python scripts/migrate_legacy_tickets.py --apply --chunk-size 50
  python scripts/migrate_legacy_tickets.py --dry-run --samples 5
        """,
    )
    parser.add_argument(
        "--dump", "-d",
        default=DEFAULT_DUMP_PATH,
        help=f"Ruta al dump SQL (default: {DEFAULT_DUMP_PATH})",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Modo dry-run: parsea SQL, muestra samples, NO inserta",
    )
    parser.add_argument(
        "--apply", "-a",
        action="store_true",
        help="Ejecutar la migración",
    )
    parser.add_argument(
        "--chunk-size", "-c",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help=f"Tickets por batch (default: {DEFAULT_CHUNK_SIZE})",
    )
    parser.add_argument(
        "--samples", "-s",
        type=int,
        default=DEFAULT_SAMPLES,
        help=f"Cantidad de samples en dry-run (default: {DEFAULT_SAMPLES})",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.dry_run and not args.apply:
        print("❌ Debes especificar --dry-run o --apply")
        sys.exit(1)

    dump_path = args.dump
    if not os.path.exists(dump_path):
        print(f"❌ Archivo no encontrado: {dump_path}")
        sys.exit(1)

    dump_size_mb = os.path.getsize(dump_path) / (1024 * 1024)
    print(f"\n{'='*70}")
    print("  MIGRACIÓN LEGACY HESK → EMERALD ERP")
    print(f"{'='*70}")
    print(f"  Archivo fuente: {dump_path}")
    print(f"  Tamaño:         {dump_size_mb:.1f} MB")
    print(f"  Modo:           {'DRY-RUN (no se insertarán datos)' if args.dry_run else 'APPLY'}")
    if args.apply:
        print(f"  Chunk size:     {args.chunk_size}")
    print(f"{'='*70}\n")

    # ── Fase 1: Parsear replies ──
    logger.info("Fase 1/3: Parseando replies...")
    replies_by_ticket = load_replies(dump_path)

    # ── Fase 2: Parsear tickets ──
    logger.info("Fase 2/3: Parseando tickets...")
    ticket_rows: list[dict] = []
    for ticket in parse_hesk_tickets(dump_path):
        ticket_rows.append(ticket)
    logger.info(f"  → {len(ticket_rows)} tickets encontrados")

    # ── Fase 3: Ejecutar ──
    if args.dry_run:
        logger.info("Fase 3/3: Mostrando samples (dry-run)...")
        show_dry_run_samples(ticket_rows, replies_by_ticket, args.samples)
        print("✅ Dry-run completado. Revisa los samples arriba.")
        return

    # ── Modo APPLY ──
    logger.info("Fase 3/3: Ejecutando migración...")

    # Importar dependencias de Emerald
    try:
        from src.database.session import SessionLocal
        from sqlalchemy import create_engine, text
    except ImportError as e:
        logger.error(f"Error importando módulos de Emerald: {e}")
        logger.error("Asegúrate de ejecutar desde el directorio raíz del proyecto con el venv activo")
        sys.exit(1)

    # Conectar a DB
    try:
        from src.config import SQLALCHEMY_DATABASE_URL
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        # Verificar conexión
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("  ✓ Conexión a base de datos exitosa")
    except Exception as e:
        logger.error(f"  ✗ Error conectando a base de datos: {e}")
        logger.error("  Verifica que PostgreSQL esté corriendo y accesible")
        sys.exit(1)

    SessionLocal = None
    try:
        from src.database.session import SessionLocal
    except ImportError:
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = SessionLocal()

    # Procesar en chunks
    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    chunk_index = 0
    start_time = time.time()

    try:
        for chunk_start in range(0, len(ticket_rows), args.chunk_size):
            chunk_index += 1
            chunk_end = min(chunk_start + args.chunk_size, len(ticket_rows))
            chunk_data = [
                (row, replies_by_ticket.get(row.get("id"), []))
                for row in ticket_rows[chunk_start:chunk_end]
            ]

            total_chunks = (len(ticket_rows) + args.chunk_size - 1) // args.chunk_size
            logger.info(
                f"Chunk {chunk_index}/{total_chunks}: "
                f"tickets {chunk_start+1}-{chunk_end}..."
            )

            result = process_chunk(db, chunk_data, chunk_index, args.chunk_size)
            total_inserted += result["inserted"]
            total_skipped += result["skipped"]
            total_errors += len(result["errors"])

            if not result["ok"]:
                logger.warning(f"  ⚠ Chunk {chunk_index} tuvo errores")

    except KeyboardInterrupt:
        logger.warning("\n⚠ Interrupción detectada. Haciendo rollback...")
        db.rollback()
        logger.info("Rollback completado.")
        sys.exit(1)

    finally:
        db.close()
        engine.dispose()

    elapsed = time.time() - start_time

    # Resumen final
    print(f"\n{'='*70}")
    print("  RESUMEN DE MIGRACIÓN")
    print(f"{'='*70}")
    print(f"  Total tickets procesados:  {len(ticket_rows)}")
    print(f"  Total insertados:          {total_inserted}")
    print(f"  Saltados (ya migrados):    {total_skipped}")
    print(f"  Errores:                   {total_errors}")
    print(f"  Duración total:            {elapsed:.1f} segundos")
    if total_inserted > 0:
        print(f"  Rendimiento:               {total_inserted/elapsed:.1f} tickets/seg")
    print(f"{'='*70}")

    if total_errors > 0:
        print("\n⚠ Hubieron errores durante la migración. Revisa los logs.")
    else:
        print("\n✅ Migración completada exitosamente.")


if __name__ == "__main__":
    main()
