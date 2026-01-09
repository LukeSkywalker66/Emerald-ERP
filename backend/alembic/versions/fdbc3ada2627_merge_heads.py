"""merge heads

Revision ID: fdbc3ada2627
Revises: e2b1d0c4f8a1, h7f8a9e2b5c3d
Create Date: 2026-01-09 10:57:44.648798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdbc3ada2627'
down_revision: Union[str, Sequence[str], None] = ('e2b1d0c4f8a1', 'h7f8a9e2b5c3d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
