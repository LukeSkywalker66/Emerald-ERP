"""add mesh installation type

Revision ID: 2026_10_07_002
Revises: 2026_10_07_001
Create Date: 2026-10-07 00:00:00.000000

Agrega la tecnología de instalación 'mesh' (red inalámbrica) a installation_types.
No es un TicketType nuevo: es una tecnología más del dropdown del wizard de
Instalación (que ya carga /v2/installation-types dinámicamente).
"""
from typing import Sequence, Union

from alembic import op


revision: str = '2026_10_07_002'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO installation_types (code, name, description, is_active)
        VALUES (
            'mesh',
            'Mesh (red inalámbrica)',
            'Instalación de sistema mesh inalámbrico con routers específicos para cobertura en espacios amplios.',
            true
        )
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM installation_types WHERE code = 'mesh'")
