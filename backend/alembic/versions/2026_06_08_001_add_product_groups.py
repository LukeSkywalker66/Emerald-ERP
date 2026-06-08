"""Add product_groups table and group_id to products

Revision ID: 2026_06_08_001
Revises: 2026_06_07_007
Create Date: 2026-06-08 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_08_001'
down_revision: Union[str, None] = '2026_06_07_007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create product_groups table
    op.create_table(
        'product_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_product_groups_id'), 'product_groups', ['id'], unique=False)
    op.create_index(op.f('ix_product_groups_name'), 'product_groups', ['name'], unique=True)

    # Add group_id to products
    op.add_column('products',
        sa.Column('group_id', sa.Integer(), nullable=True)
    )
    op.create_index(op.f('ix_products_group_id'), 'products', ['group_id'], unique=False)
    op.create_foreign_key(
        'fk_products_group_id', 'products', 'product_groups',
        ['group_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_products_group_id', 'products', type_='foreignkey')
    op.drop_index(op.f('ix_products_group_id'), table_name='products')
    op.drop_column('products', 'group_id')
    op.drop_index(op.f('ix_product_groups_name'), table_name='product_groups')
    op.drop_index(op.f('ix_product_groups_id'), table_name='product_groups')
    op.drop_table('product_groups')
