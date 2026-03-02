"""Merge coordination and ticket_reasons heads

Revision ID: 7b7dfe8236f8
Revises: 2026_02_02_002, add_ticket_reasons
Create Date: 2026-02-02 12:02:50.018435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b7dfe8236f8'
down_revision: Union[str, Sequence[str], None] = ('2026_02_02_002', 'add_ticket_reasons')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
