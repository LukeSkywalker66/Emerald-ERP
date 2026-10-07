"""mesh como tipo de ticket (no como tecnología de instalación)

Revision ID: 2026_10_07_003
Revises: 2026_10_07_002
Create Date: 2026-10-07 00:00:00.000000

Corrige el enfoque: mesh NO es una instalación de conexión nueva (el wizard de
Instalación depende de encontrar conexiones nuevas en ISPCube). Mesh es un
servicio que se instala sobre una CONEXIÓN EXISTENTE, por lo que se modela como
un tipo de ticket propio (TicketType.mesh) con su propia categoría/flujo.

- Quita 'mesh' de installation_types (para que no aparezca en el dropdown de
  Instalación).
- Crea la categoría 'Instalación Mesh' con flow_key='mesh'.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '2026_10_07_003'
down_revision: Union[str, Sequence[str], None] = '2026_10_07_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Mesh ya no es una tecnología del wizard de Instalación.
    op.execute("DELETE FROM installation_types WHERE code = 'mesh'")

    # 2) Categoría propia para el flujo mesh.
    op.execute(
        """
        INSERT INTO ticket_categories (name, description, priority_default, flow_key)
        VALUES (
            'Instalación Mesh',
            'Instalación de sistema mesh inalámbrico (routers específicos) sobre conexión existente',
            'medium',
            'mesh'
        )
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM ticket_categories WHERE flow_key = 'mesh'")
