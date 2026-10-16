"""add sale customer link

Revision ID: 2026_10_09_002
Revises: 2026_10_09_001
Create Date: 2026-10-09 00:00:00.000000

Agrega a `sales` el vínculo opcional a `clientes` (customer_id, FK con SET NULL)
y snapshots denormalizados de DNI y nombre del comprador.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_09_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_09_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sales",
        sa.Column(
            "customer_id",
            sa.Integer(),
            nullable=True,
            comment="Cliente vinculado (clientes) si el comprador está registrado",
        ),
    )
    op.add_column(
        "sales",
        sa.Column(
            "customer_dni",
            sa.String(20),
            nullable=True,
            comment="Snapshot del DNI/CUIT del comprador",
        ),
    )
    op.add_column(
        "sales",
        sa.Column(
            "customer_name",
            sa.String(200),
            nullable=True,
            comment="Snapshot del nombre del comprador",
        ),
    )
    op.create_foreign_key(
        "fk_sales_customer_id",
        "sales",
        "clientes",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_sales_customer_id", "sales", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_sales_customer_id", table_name="sales")
    op.drop_constraint("fk_sales_customer_id", "sales", type_="foreignkey")
    op.drop_column("sales", "customer_name")
    op.drop_column("sales", "customer_dni")
    op.drop_column("sales", "customer_id")
