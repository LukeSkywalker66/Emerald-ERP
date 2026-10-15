"""add installation_connection_id and parent_ticket_id

Revision ID: 2026_10_12_006
Revises: 2026_10_12_005
Create Date: 2026-10-12 00:00:00.000000

- work_orders.installation_connection_id: conexión física donde se aplicó el trabajo
  (explícita, separa "conexión de servicio" de "conexión física del activo").
- tickets.parent_ticket_id: ticket hermanado (reemplazo de equipo creado en campo).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_006'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'work_orders',
        sa.Column(
            'installation_connection_id',
            sa.Integer(),
            sa.ForeignKey('connections.connection_id', ondelete='SET NULL'),
            nullable=True,
            comment='Conexión física donde se aplicó el trabajo (explícita)',
        ),
    )
    op.create_index('ix_work_orders_installation_connection_id', 'work_orders', ['installation_connection_id'])

    op.add_column(
        'tickets',
        sa.Column(
            'parent_ticket_id',
            sa.Integer(),
            sa.ForeignKey('tickets.id', ondelete='SET NULL'),
            nullable=True,
            comment='Ticket hermanado del que nació (ej. reemplazo de equipo)',
        ),
    )
    op.create_index('ix_tickets_parent_ticket_id', 'tickets', ['parent_ticket_id'])


def downgrade() -> None:
    op.drop_index('ix_tickets_parent_ticket_id', table_name='tickets')
    op.drop_column('tickets', 'parent_ticket_id')
    op.drop_index('ix_work_orders_installation_connection_id', table_name='work_orders')
    op.drop_column('work_orders', 'installation_connection_id')
