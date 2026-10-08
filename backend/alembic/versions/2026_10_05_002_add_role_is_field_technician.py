"""add roles.is_field_technician

Revision ID: 2026_10_05_002
Revises: 2026_10_05_001
Create Date: 2026-10-05 00:00:00.000000

Agrega la columna booleana `is_field_technician` a `roles`.

Elegibilidad de perfil (no de permiso): marca si un rol corresponde a un
perfil de técnico de campo que puede integrar una cuadrilla. A diferencia de
una capability, NO es alcanzada por el wildcard `["*"]` (que solo otorga
permisos), por lo que roles como `admin` no se filtran como técnicos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_05_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_05_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'roles',
        sa.Column(
            'is_field_technician',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Perfil de técnico de campo: habilita al rol para integrar una cuadrilla.",
        ),
    )


def downgrade() -> None:
    op.drop_column('roles', 'is_field_technician')
