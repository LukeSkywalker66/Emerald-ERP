"""add TV as ticket flow (categoría Instalación TV)

Revision ID: 2026_10_12_005
Revises: 2026_10_12_004
Create Date: 2026-10-12 00:00:00.000000

TV es un servicio sobre una conexión existente (igual que mesh): no crea conexión
nueva. Se modela con una categoría propia flow_key='tv'.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_12_005'
down_revision: Union[str, Sequence[str], None] = '2026_10_12_004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO ticket_categories (name, description, priority_default, flow_key)
            VALUES (
                'Instalación TV',
                'Instalación del servicio de TV sobre una conexión existente',
                'medium',
                'tv'
            )
            ON CONFLICT (name) DO UPDATE
                SET flow_key = EXCLUDED.flow_key
                WHERE ticket_categories.flow_key IS NULL
            """
        )
    )


def downgrade() -> None:
    op.execute("DELETE FROM ticket_categories WHERE flow_key = 'tv'")
