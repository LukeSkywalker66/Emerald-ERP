"""Add tracked-units data structures (serial fields + helper tables)

Revision ID: 2026_06_17_002
Revises: 2026_06_17_001
Create Date: 2026-06-17 00:00:00.000000

Fase 2 (paso datos):
- Extiende serial_items para soportar códigos generados y saldo de compuestos
- Crea barcode_sequences para correlativos de códigos propios
- Crea consumption_logs para trazabilidad de consumo fraccionado
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2026_06_17_002"
down_revision: Union[str, None] = "2026_06_17_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema for tracked units data layer."""

    # ---------------------------------------------------------------
    # serial_items: nuevos campos para serialización propia de compuestos
    # ---------------------------------------------------------------
    op.add_column(
        "serial_items",
        sa.Column(
            "is_generated_barcode",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="True si el código fue generado por Emerald (no serial OEM)",
        ),
    )
    op.add_column(
        "serial_items",
        sa.Column(
            "initial_quantity",
            sa.Float(),
            nullable=True,
            comment="Cantidad inicial para unidades compuestas (ej: 300m)",
        ),
    )
    op.add_column(
        "serial_items",
        sa.Column(
            "remaining_quantity",
            sa.Float(),
            nullable=True,
            comment="Saldo restante para unidades compuestas (ej: 150m)",
        ),
    )

    # ---------------------------------------------------------------
    # barcode_sequences: secuencias por prefijo/año para códigos propios
    # ---------------------------------------------------------------
    op.create_table(
        "barcode_sequences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
            comment="Producto asociado a la secuencia (opcional)",
        ),
        sa.Column(
            "prefix",
            sa.String(length=20),
            nullable=False,
            comment="Prefijo legible (ej: BOB, CNT, CBL)",
        ),
        sa.Column(
            "year",
            sa.Integer(),
            nullable=False,
            comment="Año de la secuencia",
        ),
        sa.Column(
            "last_sequence",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Último correlativo utilizado",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prefix", "year", name="uq_barcode_seq_prefix_year"),
    )
    op.create_index(op.f("ix_barcode_sequences_id"), "barcode_sequences", ["id"], unique=False)
    op.create_index(op.f("ix_barcode_sequences_product_id"), "barcode_sequences", ["product_id"], unique=False)
    op.create_index(op.f("ix_barcode_sequences_prefix"), "barcode_sequences", ["prefix"], unique=False)
    op.create_index(op.f("ix_barcode_sequences_year"), "barcode_sequences", ["year"], unique=False)

    # ---------------------------------------------------------------
    # consumption_logs: historial de consumo fraccionado
    # ---------------------------------------------------------------
    op.create_table(
        "consumption_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "tracked_unit_id",
            sa.Integer(),
            sa.ForeignKey("serial_items.id", ondelete="CASCADE"),
            nullable=False,
            comment="Unidad trazable consumida (serial_items.id)",
        ),
        sa.Column(
            "work_order_id",
            sa.Integer(),
            sa.ForeignKey("work_orders.id", ondelete="SET NULL"),
            nullable=True,
            comment="OT donde se registró el consumo",
        ),
        sa.Column(
            "quantity_consumed",
            sa.Float(),
            nullable=False,
            comment="Cantidad consumida en unidades base",
        ),
        sa.Column(
            "quantity_before",
            sa.Float(),
            nullable=False,
            comment="Saldo antes del consumo",
        ),
        sa.Column(
            "quantity_after",
            sa.Float(),
            nullable=False,
            comment="Saldo después del consumo",
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            comment="Usuario que registró el consumo",
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
            comment="Almacén donde ocurrió el consumo",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_consumption_logs_id"), "consumption_logs", ["id"], unique=False)
    op.create_index(op.f("ix_consumption_logs_tracked_unit_id"), "consumption_logs", ["tracked_unit_id"], unique=False)
    op.create_index(op.f("ix_consumption_logs_work_order_id"), "consumption_logs", ["work_order_id"], unique=False)
    op.create_index(op.f("ix_consumption_logs_user_id"), "consumption_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_consumption_logs_warehouse_id"), "consumption_logs", ["warehouse_id"], unique=False)
    op.create_index(op.f("ix_consumption_logs_created_at"), "consumption_logs", ["created_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema for tracked units data layer."""

    # consumption_logs
    op.drop_index(op.f("ix_consumption_logs_created_at"), table_name="consumption_logs")
    op.drop_index(op.f("ix_consumption_logs_warehouse_id"), table_name="consumption_logs")
    op.drop_index(op.f("ix_consumption_logs_user_id"), table_name="consumption_logs")
    op.drop_index(op.f("ix_consumption_logs_work_order_id"), table_name="consumption_logs")
    op.drop_index(op.f("ix_consumption_logs_tracked_unit_id"), table_name="consumption_logs")
    op.drop_index(op.f("ix_consumption_logs_id"), table_name="consumption_logs")
    op.drop_table("consumption_logs")

    # barcode_sequences
    op.drop_index(op.f("ix_barcode_sequences_year"), table_name="barcode_sequences")
    op.drop_index(op.f("ix_barcode_sequences_prefix"), table_name="barcode_sequences")
    op.drop_index(op.f("ix_barcode_sequences_product_id"), table_name="barcode_sequences")
    op.drop_index(op.f("ix_barcode_sequences_id"), table_name="barcode_sequences")
    op.drop_table("barcode_sequences")

    # serial_items columns
    op.drop_column("serial_items", "remaining_quantity")
    op.drop_column("serial_items", "initial_quantity")
    op.drop_column("serial_items", "is_generated_barcode")
