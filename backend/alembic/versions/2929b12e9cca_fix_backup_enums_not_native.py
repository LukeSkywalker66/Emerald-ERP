"""fix_backup_enums_not_native

Revision ID: 2929b12e9cca
Revises: 2026_06_25_002_backup_minio
Create Date: 2026-06-25 22:46:16.459429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2929b12e9cca'
down_revision: Union[str, Sequence[str], None] = '2026_06_25_002_backup_minio'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
