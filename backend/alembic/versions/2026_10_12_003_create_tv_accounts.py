"""create tv_accounts and seed 001..250

Revision ID: 2026_10_12_003
Revises: 2026_10_12_002
Create Date: 2026-10-12 00:00:00.000000

Tabla de cuentas de TV (usuarios PPPoE de IPTV) reutilizables.
- username: clienteNNN@2finternet.ar (NNN = 001..250)
- password: 3190NNN.
- connection_id nullable: NULL = libre; no NULL = en uso.
- assigned_at / released_at: alta/baja de la última asignación.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_003'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tv_accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(120), nullable=False),
        sa.Column('password', sa.String(120), nullable=False),
        sa.Column(
            'connection_id',
            sa.Integer(),
            sa.ForeignKey('connections.connection_id', ondelete='SET NULL'),
            nullable=True,
            comment='Conexión a la que está asignado (NULL = libre)',
        ),
        sa.Column(
            'status',
            sa.String(20),
            nullable=False,
            server_default='available',
            comment='available | assigned',
        ),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )
    op.create_index('ix_tv_accounts_connection_id', 'tv_accounts', ['connection_id'])
    op.create_index('ix_tv_accounts_status', 'tv_accounts', ['status'])

    # Seed 250 usuarios reutilizables: cliente001..cliente250 / 3190001....3190250.
    op.execute(
        """
        INSERT INTO tv_accounts (username, password, status, created_at, updated_at)
        SELECT 'cliente' || lpad(gs::text, 3, '0') || '@2finternet.ar',
               '3190' || lpad(gs::text, 3, '0') || '.',
               'available',
               CURRENT_TIMESTAMP,
               CURRENT_TIMESTAMP
        FROM generate_series(1, 250) AS gs
        """
    )


def downgrade() -> None:
    op.drop_index('ix_tv_accounts_status', table_name='tv_accounts')
    op.drop_index('ix_tv_accounts_connection_id', table_name='tv_accounts')
    op.drop_table('tv_accounts')
