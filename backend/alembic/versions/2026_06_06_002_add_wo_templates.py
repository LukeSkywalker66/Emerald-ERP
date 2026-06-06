"""add_wo_templates

Revision ID: 2026_06_06_002
Revises: 2026_06_06_001
Create Date: 2026-06-06 11:00:00.000000

Agrega tablas para plantillas de materiales por tipo de visita:
  - wo_templates: plantillas configurables por admin
  - wo_template_items: productos en cada plantilla
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_06_002'
down_revision: Union[str, Sequence[str], None] = '2026_06_06_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabla: wo_templates
    op.create_table(
        'wo_templates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ot_type', sa.String(length=50), nullable=True, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
    )

    # Tabla: wo_template_items
    op.create_table(
        'wo_template_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('default_quantity', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['wo_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('wo_template_items')
    op.drop_table('wo_templates')
