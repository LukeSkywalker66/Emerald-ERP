"""add_plans_table

Revision ID: 324f44f48d0a
Revises: a2f6d6839294
Create Date: 2025-12-30 16:56:32.942098

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '324f44f48d0a'
down_revision: Union[str, Sequence[str], None] = 'a2f6d6839294'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create plans table for Beholder sync."""
    op.create_table(
        "plans",
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("speed", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("plan_id"),
    )


def downgrade() -> None:
    """Drop plans table."""
    op.drop_table("plans")
