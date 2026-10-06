"""add roles.capabilities

Revision ID: 2026_10_05_001
Revises: 2026_09_26_001
Create Date: 2026-10-05 00:00:00.000000

Agrega una columna JSONB `capabilities` a `roles` para el nuevo RBAC canónico
(slugs `recurso.accion`). Se mantiene intacta la columna legada `permissions`
(usada por endpoints v1 legacy), evitando regresiones.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '2026_10_05_001'
down_revision: Union[str, Sequence[str], None] = '2026_09_26_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'roles',
        sa.Column(
            'capabilities',
            postgresql.JSONB(),
            nullable=True,
            comment="Capacidades canónicas RBAC (slugs recurso.accion). Nulo = sin capacidades.",
        ),
    )


def downgrade() -> None:
    op.drop_column('roles', 'capabilities')
