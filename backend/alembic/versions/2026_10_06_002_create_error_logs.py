"""create error_logs

Revision ID: 2026_10_06_002
Revises: 2026_10_06_001
Create Date: 2026-10-06 00:00:00.000000

Crea la tabla `error_logs` para capturar errores de backend (excepciones no
manejadas) y de frontend (reportados por el cliente vía POST /api/v2/error-logs).
Permite dar seguimiento a fallas que ocurren en dispositivos remotos de técnicos
sin acceso directo a logs del servidor.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '2026_10_06_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_06_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('level', sa.String(20), nullable=False, server_default='ERROR'),
        sa.Column('source', sa.String(20), nullable=False, server_default='backend'),
        sa.Column('module', sa.String(120), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('stack_trace', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('request_method', sa.String(10), nullable=True),
        sa.Column('request_path', sa.String(255), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('context', postgresql.JSONB(), nullable=True),
    )
    op.create_index('ix_error_logs_created_at', 'error_logs', ['created_at'])
    op.create_index('ix_error_logs_level', 'error_logs', ['level'])
    op.create_index('ix_error_logs_source', 'error_logs', ['source'])
    op.create_index('ix_error_logs_user_id', 'error_logs', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_error_logs_user_id', table_name='error_logs')
    op.drop_index('ix_error_logs_source', table_name='error_logs')
    op.drop_index('ix_error_logs_level', table_name='error_logs')
    op.drop_index('ix_error_logs_created_at', table_name='error_logs')
    op.drop_table('error_logs')
