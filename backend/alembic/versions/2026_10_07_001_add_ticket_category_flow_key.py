"""add ticket_categories.flow_key + rename Falla Técnica → Servicio Técnico

Revision ID: 2026_10_07_001
Revises: 2026_10_06_002
Create Date: 2026-10-07 00:00:00.000000

Hace el mapeo categoría → flujo de creación data-driven (columna `flow_key`),
eliminando la dependencia del frontend de parsear el NOMBRE de la categoría.

También renombra la categoría "Falla Técnica" → "Servicio Técnico" (idempotente).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_07_001'
down_revision: Union[str, Sequence[str], None] = '2026_10_06_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_FLOW_BY_NAME = [
    ("Servicio Técnico", "technical"),
    ("Falla Técnica", "technical"),  # por si el rename no aplicó (ambos existen)
    ("Administrativo", "administrative"),
    ("Instalación", "installation"),
    ("Traslado", "relocation"),
    ("Baja", "withdrawal"),
    ("Pase a Fibra", "fiber_migration"),
]


def upgrade() -> None:
    op.add_column(
        'ticket_categories',
        sa.Column('flow_key', sa.String(40), nullable=True,
                  comment="Slug del flujo de creación (technical, installation, ...)"),
    )

    # Renombrar categoría (idempotente; el nombre tiene UNIQUE).
    op.execute(
        "UPDATE ticket_categories SET name = 'Servicio Técnico' "
        "WHERE name = 'Falla Técnica' "
        "AND NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = 'Servicio Técnico')"
    )

    # Backfill de flow_key por nombre (idempotente).
    for name, flow_key in _FLOW_BY_NAME:
        op.execute(
            f"UPDATE ticket_categories SET flow_key = '{flow_key}' "
            f"WHERE name = '{name}' AND flow_key IS NULL"
        )


def downgrade() -> None:
    op.drop_column('ticket_categories', 'flow_key')
