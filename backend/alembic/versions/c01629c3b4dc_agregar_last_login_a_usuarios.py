"""agregar last_login a usuarios

Revision ID: c01629c3b4dc
Revises: fdbc3ada2627
Create Date: 2026-01-09 10:58:10.773296

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c01629c3b4dc'
down_revision: Union[str, Sequence[str], None] = 'fdbc3ada2627'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar columna last_login a users sin tocar tablas de tickets legacy."""
    op.add_column(
        'users',
        sa.Column(
            'last_login',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Último login exitoso del usuario',
        ),
    )
    op.create_index(op.f('ix_users_last_login'), 'users', ['last_login'], unique=False)


def downgrade() -> None:
    """Revertir columna last_login."""
    op.drop_index(op.f('ix_users_last_login'), table_name='users')
    op.drop_column('users', 'last_login')
