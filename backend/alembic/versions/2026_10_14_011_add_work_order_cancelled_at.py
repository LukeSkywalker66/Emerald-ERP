"""add work_orders.cancelled_at

Revision ID: 2026_10_14_011
Revises: 2026_10_14_010
Create Date: 2026-10-14 00:00:00.000000

Soporta la cancelación carrier-class de OTs no coordinadas: el estado pasa a
`cancelled` (soft-cancel, nunca se borra) y se registra cuándo ocurrió.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_14_011'
down_revision: Union[str, Sequence[str], None] = '2026_10_14_010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column(
            "cancelled_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Fecha/hora de cancelación por operador (soft-cancel)",
        ),
    )


def downgrade() -> None:
    op.drop_column("work_orders", "cancelled_at")
