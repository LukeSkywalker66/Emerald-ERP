"""fix_work_order_status_enum_values

Revision ID: g6e7f4d3c0b1a
Revises: e4c5f2d1a8b9
Create Date: 2026-01-05 12:01:31.170424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


revision: str = 'g6e7f4d3c0b1a'
down_revision: Union[str, Sequence[str], None] = 'e4c5f2d1a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - fix work_order_status varchar values to lowercase."""
    # La columna status es varchar, no enum, así que conversión simple
    op.execute("""
        UPDATE work_orders 
        SET status = LOWER(status)
    """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
