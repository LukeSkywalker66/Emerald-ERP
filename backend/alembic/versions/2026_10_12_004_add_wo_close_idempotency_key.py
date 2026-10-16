"""add work_orders.close_idempotency_key

Revision ID: 2026_10_12_004
Revises: 2026_10_12_003
Create Date: 2026-10-12 00:00:00.000000

Clave de idempotencia del cierre: ante un reintento con la misma clave, el backend
devuelve la OT ya cerrada sin duplicar el consumo de inventario (§7).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_004'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'work_orders',
        sa.Column(
            'close_idempotency_key',
            sa.String(100),
            nullable=True,
            comment='Clave de idempotencia del cierre (generada por el frontend al abrir el wizard)',
        ),
    )
    op.create_index('ix_work_orders_close_idempotency_key', 'work_orders', ['close_idempotency_key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_work_orders_close_idempotency_key', table_name='work_orders')
    op.drop_column('work_orders', 'close_idempotency_key')
