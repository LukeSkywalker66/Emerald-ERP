"""fix_priority_uppercase_data

Revision ID: fabcca987f2b
Revises: d7b5e1c2f8a0
Create Date: 2026-01-05 11:56:31.170424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'fabcca987f2b'
down_revision: Union[str, Sequence[str], None] = 'd7b5e1c2f8a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - fix uppercase priority values in tickets_v2."""
    # Convertir valores en mayúscula a minúsculas en la tabla tickets_v2
    op.execute("""
        UPDATE tickets_v2 SET priority = 'low' WHERE priority = 'LOW';
        UPDATE tickets_v2 SET priority = 'medium' WHERE priority = 'MEDIUM';
        UPDATE tickets_v2 SET priority = 'high' WHERE priority = 'HIGH';
        UPDATE tickets_v2 SET priority = 'critical' WHERE priority = 'CRITICAL';
    """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
