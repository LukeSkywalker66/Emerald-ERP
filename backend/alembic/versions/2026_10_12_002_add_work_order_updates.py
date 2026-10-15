"""add work_order_updates (bitácora post-cierre)

Revision ID: 2026_10_12_002
Revises: 2026_10_12_001
Create Date: 2026-10-12 00:00:00.000000

Crea la bitácora append-only de actualizaciones post-cierre de una OT.
No se edita la OT cerrada: se agregan entradas auditadas (P2).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '2026_10_12_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'work_order_updates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            'work_order_id',
            sa.Integer(),
            sa.ForeignKey('work_orders.id', ondelete='CASCADE'),
            nullable=False,
            comment='OT sobre la que se registra la actualización',
        ),
        sa.Column(
            'author_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
            comment='Usuario que registró la actualización',
        ),
        sa.Column(
            'update_type',
            sa.String(50),
            nullable=False,
            comment='MATERIALS_ADDED | MATERIALS_REMOVED | MATERIALS_REPLACED | MATERIALS_QTY_UPDATED | INFO_CORRECTION | CLOSE_CORRECTION | NOTE',
        ),
        sa.Column(
            'status',
            sa.String(50),
            nullable=False,
            server_default='APPLIED',
            comment='APPLIED | PROPOSED | APPROVED | REJECTED',
        ),
        sa.Column('motive', sa.Text(), nullable=False, comment='Motivo obligatorio de la corrección'),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Detalle estructurado de la corrección'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_work_order_updates_work_order_id', 'work_order_updates', ['work_order_id'])
    op.create_index('ix_work_order_updates_author_id', 'work_order_updates', ['author_id'])


def downgrade() -> None:
    op.drop_index('ix_work_order_updates_author_id', table_name='work_order_updates')
    op.drop_index('ix_work_order_updates_work_order_id', table_name='work_order_updates')
    op.drop_table('work_order_updates')
