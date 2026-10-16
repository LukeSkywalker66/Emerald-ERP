"""agregar tipo de ticket interno (infraestructura/oficina, sin conexión)

Revision ID: 2026_10_16_001
Revises: 2026_10_14_011
Create Date: 2026-10-16 00:00:00.000000

Los tickets internos (postes, fibra en calle, NAP, nodos, torres, grupos
electrógenos, oficina) no referencian una conexión de cliente. Se modelan como
un TicketType nuevo con subtipo propio y referencias opcionales de
infraestructura (nodo + ubicación libre), reutilizando el flujo de OT de tipo
`infrastructure`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_10_16_001'
down_revision: Union[str, Sequence[str], None] = '2026_10_14_011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columnas nuevas para el flujo interno. `ticket_type` y
    # `administrative_subtype` ya son VARCHAR sin CHECK constraint, por lo que el
    # nuevo valor `internal` no requiere migración de enum.
    op.add_column('tickets', sa.Column('internal_subtype', sa.String(length=32), nullable=True))
    op.add_column('tickets', sa.Column('internal_node_id', sa.Integer(), nullable=True))
    op.add_column('tickets', sa.Column('internal_location', sa.String(length=255), nullable=True))
    op.create_index('ix_tickets_internal_node_id', 'tickets', ['internal_node_id'], unique=False)

    # Categoría propia para el flujo interno (data-driven en el wizard de tickets).
    op.execute(
        """
        INSERT INTO ticket_categories (name, description, priority_default, flow_key)
        VALUES (
            'Interno',
            'Trabajo interno de infraestructura u oficina sin conexión de cliente',
            'medium',
            'internal'
        )
        ON CONFLICT (name) DO UPDATE
            SET flow_key = EXCLUDED.flow_key
            WHERE ticket_categories.flow_key IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM ticket_categories WHERE flow_key = 'internal'")
    op.drop_index('ix_tickets_internal_node_id', table_name='tickets')
    op.drop_column('tickets', 'internal_location')
    op.drop_column('tickets', 'internal_node_id')
    op.drop_column('tickets', 'internal_subtype')
