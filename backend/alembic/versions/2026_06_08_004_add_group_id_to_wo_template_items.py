"""Add group_id to wo_template_items for group-based material templates

Revision ID: 2026_06_08_004
Revises: 2026_06_08_003
Create Date: 2026-06-08 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_08_004'
down_revision: Union[str, None] = '2026_06_08_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make product_id nullable
    op.alter_column('wo_template_items', 'product_id',
                    existing_type=sa.Integer(),
                    nullable=True)

    # Add group_id column
    op.add_column('wo_template_items',
        sa.Column('group_id', sa.Integer(), nullable=True)
    )
    op.create_index(op.f('ix_wo_template_items_group_id'), 'wo_template_items',
                    ['group_id'], unique=False)
    op.create_foreign_key(
        'fk_wo_template_items_group_id', 'wo_template_items', 'product_groups',
        ['group_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_wo_template_items_group_id', 'wo_template_items', type_='foreignkey')
    op.drop_index(op.f('ix_wo_template_items_group_id'), table_name='wo_template_items')
    op.drop_column('wo_template_items', 'group_id')
    op.alter_column('wo_template_items', 'product_id',
                    existing_type=sa.Integer(),
                    nullable=False)
