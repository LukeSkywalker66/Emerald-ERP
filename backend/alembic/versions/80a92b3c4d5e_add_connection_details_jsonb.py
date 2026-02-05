"""add connection_details jsonb to tickets

Revision ID: 80a92b3c4d5e
Revises: 70981e467bed
Create Date: 2026-02-05 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80a92b3c4d5e'
down_revision: Union[str, Sequence[str], None] = '70981e467bed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add connection_details JSONB to tickets"""
    op.add_column(
        'tickets',
        sa.Column(
            'connection_details',
            sa.JSON(),
            nullable=True,
            comment='Datos de contacto del cliente: {phone, client_name, client_dni, address, city, ...}'
        )
    )


def downgrade() -> None:
    """Downgrade schema - remove connection_details from tickets"""
    op.drop_column('tickets', 'connection_details')
