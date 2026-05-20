"""create_product_categories_table

Revision ID: 2026_05_20_002
Revises: 2026_05_20_001
Create Date: 2026-05-20 20:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2026_05_20_002"
down_revision: Union[str, Sequence[str], None] = "2026_05_20_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create product_categories table and seed initial data."""
    op.create_table(
        "product_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_product_categories_name"),
    )

    op.create_index(op.f("ix_product_categories_id"), "product_categories", ["id"], unique=False)
    op.create_index(op.f("ix_product_categories_name"), "product_categories", ["name"], unique=True)
    op.create_index(op.f("ix_product_categories_is_active"), "product_categories", ["is_active"], unique=False)

    # Seed the 4 initial product categories
    op.execute(
        """
        INSERT INTO product_categories (name, is_active) VALUES
        ('Cableado', true),
        ('Equipos', true),
        ('Accesorios', true),
        ('Herramientas', true)
        """
    )


def downgrade() -> None:
    """Drop product_categories table."""
    op.drop_index(op.f("ix_product_categories_is_active"), table_name="product_categories")
    op.drop_index(op.f("ix_product_categories_name"), table_name="product_categories")
    op.drop_index(op.f("ix_product_categories_id"), table_name="product_categories")
    op.drop_table("product_categories")
