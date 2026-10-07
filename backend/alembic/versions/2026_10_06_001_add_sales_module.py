"""add sales module

Revision ID: 2026_10_06_001
Revises: 2026_10_05_002
Create Date: 2026-10-06 00:00:00.000000

Agrega el módulo de Ventas al Público (MVP de acción de stock):

- Tablas `sales` y `sale_items` (encabezado + líneas de una venta).
- Extiende el CHECK de `serial_items.status` para admitir el estado `SOLD`
  (un serial vendido deja de estar disponible para despacho/consumo).

`stock_movements.movement_type` ya es VARCHAR sin CHECK, por lo que los nuevos
movimientos `SALE` / `SALE_RETURN` no requieren cambio de esquema.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_06_001'
down_revision: Union[str, Sequence[str], None] = '2026_10_05_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_SERIAL_STATUSES = (
    "NEW",
    "IN_VEHICLE",
    "INSTALLED",
    "DEFECTIVE",
    "DAMAGED",
    "DECOMMISSIONED",
    "SOLD",
)


def upgrade() -> None:
    # 1. Permitir SOLD en serial_items.status (recrear el CHECK constraint).
    op.execute("ALTER TABLE serial_items DROP CONSTRAINT IF EXISTS ck_serial_items_status_valid")
    op.execute(
        "ALTER TABLE serial_items ADD CONSTRAINT ck_serial_items_status_valid "
        f"CHECK (status IN ({', '.join(repr(s) for s in _SERIAL_STATUSES)}))"
    )

    # 2. Tabla de ventas (encabezado).
    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "sale_number",
            sa.String(30),
            nullable=False,
            unique=True,
            comment="Correlativo legible de la venta (VTA-YYYY-NNNNN)",
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
            comment="Depósito que descuenta stock (default CENTRAL, elegible)",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="DRAFT",
            comment="DRAFT | CONFIRMED | CANCELLED",
        ),
        sa.Column(
            "reference",
            sa.String(200),
            nullable=True,
            comment="Texto libre: nombre/DNI del comprador, comprobante externo, etc.",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "seller_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
            comment="Usuario que registró la venta",
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
    )
    op.create_index("ix_sales_warehouse_id", "sales", ["warehouse_id"])
    op.create_index("ix_sales_seller_user_id", "sales", ["seller_user_id"])

    # 3. Tabla de líneas de venta.
    op.create_table(
        "sale_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "sale_id",
            sa.Integer(),
            sa.ForeignKey("sales.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1"),
        sa.Column(
            "serial_item_id",
            sa.Integer(),
            sa.ForeignKey("serial_items.id", ondelete="SET NULL"),
            nullable=True,
            comment="Serial vendido (obligatorio si el producto es SERIALIZED)",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_sale_items_sale_id", "sale_items", ["sale_id"])
    op.create_index("ix_sale_items_product_id", "sale_items", ["product_id"])
    op.create_index("ix_sale_items_serial_item_id", "sale_items", ["serial_item_id"])


def downgrade() -> None:
    op.drop_table("sale_items")
    op.drop_table("sales")

    op.execute("ALTER TABLE serial_items DROP CONSTRAINT IF EXISTS ck_serial_items_status_valid")
    op.execute(
        "ALTER TABLE serial_items ADD CONSTRAINT ck_serial_items_status_valid "
        "CHECK (status IN ('NEW','IN_VEHICLE','INSTALLED','DEFECTIVE','DAMAGED','DECOMMISSIONED'))"
    )
