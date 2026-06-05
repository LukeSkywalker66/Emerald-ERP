"""convert_native_enums_to_varchar

Revision ID: 2026_06_05_001
Revises: 2026_05_23_003
Create Date: 2026-06-05 12:00:00.000000

Convierte columnas enum nativas de PostgreSQL a VARCHAR(50)
para alinear con modelos SQLAlchemy (native_enum=False).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_05_001'
down_revision: Union[str, Sequence[str], None] = '2026_05_23_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Columnas a convertir: (tabla, columna)
CONVERSIONS = [
    ("tickets", "ticket_type"),
    ("tickets", "administrative_subtype"),
    ("work_orders", "status"),
    ("engineering_tasks", "priority"),
    ("engineering_tasks", "status"),
    ("engineering_tasks", "task_type"),
    ("products", "type"),
    ("serial_items", "status"),
    ("stock_movements", "movement_type"),
    ("team_members", "role"),
    ("ticket_events", "event_type"),
    ("tickets_legacy", "priority"),
    ("vehicles", "status"),
    ("warehouses", "type"),
]


def upgrade() -> None:
    # 1. Dropear índices parciales que referencian enums
    _drop_partial_indexes()
    
    # 2. Convertir columnas
    for table, column in CONVERSIONS:
        _convert_column(table, column)
    
    # 3. Dropear tipos enum no usados
    _drop_unused_enums()


def _drop_partial_indexes() -> None:
    """Elimina índices con WHERE conditions que referencian tipos enum."""
    op.execute("DROP INDEX IF EXISTS ix_work_orders_pending_closure")
    op.execute("DROP INDEX IF EXISTS ix_work_orders_pending_closure_by_tech")


def _convert_column(table: str, column: str) -> None:
    """Convierte una columna de enum nativo a VARCHAR(50)."""
    try:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
    except Exception:
        pass
    try:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE VARCHAR(50) USING {column}::text"
        )
    except Exception as e:
        print(f"  ⚠️  {table}.{column}: {e}")


def _drop_unused_enums() -> None:
    """Elimina tipos enum que ya no tienen columnas que los usen."""
    conn = op.get_bind()
    rows = conn.execute(sa.text("""
        SELECT t.typname
        FROM pg_type t
        WHERE t.typtype = 'e'
        AND t.typname LIKE '%_enum'
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
            JOIN pg_catalog.pg_type ct ON ct.oid = a.atttypid
            WHERE ct.typname = t.typname
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND c.relkind = 'r'
        )
        ORDER BY t.typname
    """)).fetchall()
    for row in rows:
        try:
            op.execute(f"DROP TYPE IF EXISTS {row[0]} CASCADE")
            print(f"  🗑️  Dropped unused enum: {row[0]}")
        except Exception:
            pass


def downgrade() -> None:
    pass
