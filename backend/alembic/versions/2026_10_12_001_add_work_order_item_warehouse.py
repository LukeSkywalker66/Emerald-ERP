"""add work_order_items.warehouse_id

Revision ID: 2026_10_12_001
Revises: 2026_10_09_002
Create Date: 2026-10-12 00:00:00.000000

Persiste el depósito MOBILE de origen en cada item de OT para que el cierre
descuente exactamente del mismo depósito que validó/mostró stock al cargar el
material. Elimina la deriva de resolución de depósito entre alta y cierre.

`warehouse_id` es nullable: las filas legacy (cargadas antes de esta migración)
quedan en NULL y el cierre mantiene el comportamiento anterior de re-resolución.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_001'
down_revision: Union[str, Sequence[str], None] = '2026_10_09_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_order_items",
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            nullable=True,
            comment="Depósito MOBILE de origen del material (fuente autoritativa del descuento en el cierre)",
        ),
    )
    op.create_foreign_key(
        "fk_work_order_items_warehouse_id",
        "work_order_items",
        "warehouses",
        ["warehouse_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_work_order_items_warehouse_id", "work_order_items", ["warehouse_id"])


def downgrade() -> None:
    op.drop_index("ix_work_order_items_warehouse_id", table_name="work_order_items")
    op.drop_constraint("fk_work_order_items_warehouse_id", "work_order_items", type_="foreignkey")
    op.drop_column("work_order_items", "warehouse_id")
