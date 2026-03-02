"""merge heads

Revision ID: 0f8c172a0f1e
Revises: 2026_02_09_001, 80a92b3c4d5e
Create Date: 2026-02-09 22:44:50.945908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f8c172a0f1e'
down_revision: Union[str, Sequence[str], None] = ('2026_02_09_001', '80a92b3c4d5e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
