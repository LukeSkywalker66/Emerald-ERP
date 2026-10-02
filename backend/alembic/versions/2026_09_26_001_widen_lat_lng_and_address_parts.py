"""widen lat/lng to numeric(15,12) and add connections.address_parts

Revision ID: 2026_09_26_001
Revises: 2026_09_25_001
Create Date: 2026-09-26 00:00:00.000000

ISPCube entrega lat/lng como strings con hasta 12 decimales. Las columnas
`Numeric(10, 8)` no alcanzaban (redondeaban y no admiten longitudes de 3 dígitos
enteros como -180). Se amplían a `Numeric(15, 12)` para guardar la coordenada
exacta sin redondear nada.

Además se agrega `connections.address_parts` (JSONB) para persistir todos los
campos de dirección que ISPCube trae (calle, entre calles, barrio, localidad,
ciudad, provincia, CP, extras) y mostrárselos al técnico en campo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '2026_09_26_001'
down_revision: Union[str, Sequence[str], None] = '2026_09_25_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ('connections', 'work_orders'):
        op.alter_column(
            table,
            'latitude',
            existing_type=sa.Numeric(10, 8),
            type_=sa.Numeric(15, 12),
            existing_nullable=True,
        )
        op.alter_column(
            table,
            'longitude',
            existing_type=sa.Numeric(10, 8),
            type_=sa.Numeric(15, 12),
            existing_nullable=True,
        )

    op.add_column(
        'connections',
        sa.Column(
            'address_parts',
            postgresql.JSONB(),
            nullable=True,
            comment=(
                "Campos de dirección sondeados del payload de ISPCube "
                "(calle, entre calles, barrio, localidad, ciudad, provincia, CP, extras)."
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column('connections', 'address_parts')

    for table in ('connections', 'work_orders'):
        op.alter_column(
            table,
            'latitude',
            existing_type=sa.Numeric(15, 12),
            type_=sa.Numeric(10, 8),
            existing_nullable=True,
        )
        op.alter_column(
            table,
            'longitude',
            existing_type=sa.Numeric(15, 12),
            type_=sa.Numeric(10, 8),
            existing_nullable=True,
        )
