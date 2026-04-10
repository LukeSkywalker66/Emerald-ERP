"""Merge vehicle inspections and universal audit logs

Revision ID: df251a6435bc
Revises: 2026_03_11_001, a6170cb2f62b
Create Date: 2026-04-10 20:43:57.062637

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df251a6435bc'
down_revision: Union[str, Sequence[str], None] = ('2026_03_11_001', 'a6170cb2f62b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
