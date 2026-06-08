"""Add composite product fields and product_specs table

Revision ID: 2026_06_08_002
Revises: 2026_06_08_001
Create Date: 2026-06-08 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '2026_06_08_002'
down_revision: Union[str, None] = '2026_06_08_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add composite product fields to products
    op.add_column('products',
        sa.Column('unit_size', sa.Float(), nullable=True,
                  comment='Tamaño de 1 unidad compuesta (ej: 300 para bobina drop)')
    )
    op.add_column('products',
        sa.Column('unit_measure', sa.String(20), nullable=True,
                  comment='Unidad de medida (m, units, pcs)')
    )
    op.add_column('products',
        sa.Column('is_composite', sa.Boolean(), nullable=False,
                  server_default=sa.text('false'),
                  comment='True si se compra entero pero se consume fraccionadamente')
    )
    op.add_column('products',
        sa.Column('composite_unit_label', sa.String(50), nullable=True,
                  comment='Etiqueta de unidad compuesta (Bobina, Blister, Cajita)')
    )

    # Create product_specs table
    op.create_table(
        'product_specs',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('specs', JSONB(), nullable=True,
                  comment='Especificaciones técnicas en JSONB'),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'],
                                name='fk_product_specs_product_id',
                                ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id')
    )
    op.create_index(op.f('ix_product_specs_product_id'), 'product_specs',
                    ['product_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_product_specs_product_id'), table_name='product_specs')
    op.drop_table('product_specs')
    op.drop_column('products', 'composite_unit_label')
    op.drop_column('products', 'is_composite')
    op.drop_column('products', 'unit_measure')
    op.drop_column('products', 'unit_size')
