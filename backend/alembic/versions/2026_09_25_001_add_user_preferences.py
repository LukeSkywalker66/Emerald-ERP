"""add user_preferences

Revision ID: 2026_09_25_001
Revises: 2026_09_23_001
Create Date: 2026-09-25 00:00:00.000000

Memoria de vistas por usuario: guarda filtros, orden y paginación de cada
grilla/módulo en un payload JSONB versionado (schema_version). Permite que
las preferencias sigan al usuario entre dispositivos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '2026_09_25_001'
down_revision: Union[str, Sequence[str], None] = '2026_09_23_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('module_key', sa.String(length=100), nullable=False),
        sa.Column(
            'payload',
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            'schema_version',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('1'),
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'module_key', name='uq_user_preferences_user_module'),
    )


def downgrade() -> None:
    op.drop_table('user_preferences')
