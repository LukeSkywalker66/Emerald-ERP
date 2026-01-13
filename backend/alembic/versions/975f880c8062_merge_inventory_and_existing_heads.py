"""merge_inventory_and_existing_heads

Revision ID: 975f880c8062
Revises: c01629c3b4dc, i8j9k0l1m2n3o
Create Date: 2026-01-12 12:43:31.524755

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '975f880c8062'
down_revision: Union[str, Sequence[str], None] = ('c01629c3b4dc', 'i8j9k0l1m2n3o')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
