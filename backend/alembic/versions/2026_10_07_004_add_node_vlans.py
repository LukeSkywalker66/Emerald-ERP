"""add nodes.vlans

Revision ID: 2026_10_07_004
Revises: 2026_10_07_003
Create Date: 2026-10-07 00:00:00.000000

Agrega la columna `vlans` a `nodes` para el diccionario nodo → VLANs.

Valor: string con las VLANs separadas por coma (ej. '700' o '100,300'), sin
prefijo 'vlan'. Null = nodo sin VLAN. Alimentado por DB por ahora; se
normalizará en un módulo de nodos futuro.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_07_004'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'nodes',
        sa.Column(
            'vlans',
            sa.String(255),
            nullable=True,
            comment="VLANs del nodo separadas por coma (ej: '700' o '100,300'). Null = sin VLAN.",
        ),
    )


def downgrade() -> None:
    op.drop_column('nodes', 'vlans')
