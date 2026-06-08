"""Create logistics tables for material deliveries and receipts

Revision ID: 2026_06_08_003
Revises: 2026_06_08_002
Create Date: 2026-06-08 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_08_003'
down_revision: Union[str, None] = '2026_06_08_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================
    # MATERIAL DELIVERIES
    # ============================================
    op.create_table(
        'material_deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('warehouse_from_id', sa.Integer(), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('warehouse_to_id', sa.Integer(), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT', index=True),
        sa.Column('proposal_generated_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_material_deliveries_id'), 'material_deliveries', ['id'], unique=False)

    op.create_table(
        'material_delivery_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('delivery_id', sa.Integer(), sa.ForeignKey('material_deliveries.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('quantity_proposed', sa.Float(), nullable=False, server_default='0'),
        sa.Column('quantity_delivered', sa.Float(), nullable=False, server_default='0'),
        sa.Column('is_serialized', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('serial_item_id', sa.Integer(), sa.ForeignKey('serial_items.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('source', sa.String(20), nullable=False, server_default='PROPOSAL'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_material_delivery_items_id'), 'material_delivery_items', ['id'], unique=False)
    op.create_index(op.f('ix_material_delivery_items_delivery'), 'material_delivery_items',
                    ['delivery_id', 'product_id'], unique=False)

    # ============================================
    # MATERIAL RECEIPTS
    # ============================================
    op.create_table(
        'material_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('warehouse_from_id', sa.Integer(), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('warehouse_to_id', sa.Integer(), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('received_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('received_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_material_receipts_id'), 'material_receipts', ['id'], unique=False)

    op.create_table(
        'material_receipt_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('receipt_id', sa.Integer(), sa.ForeignKey('material_receipts.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('serial_item_id', sa.Integer(), sa.ForeignKey('serial_items.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('condition', sa.String(20), nullable=False, server_default='GOOD'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_material_receipt_items_id'), 'material_receipt_items', ['id'], unique=False)
    op.create_index(op.f('ix_material_receipt_items_receipt'), 'material_receipt_items',
                    ['receipt_id', 'product_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_material_receipt_items_receipt'), table_name='material_receipt_items')
    op.drop_index(op.f('ix_material_receipt_items_id'), table_name='material_receipt_items')
    op.drop_table('material_receipt_items')
    op.drop_index(op.f('ix_material_receipts_id'), table_name='material_receipts')
    op.drop_table('material_receipts')
    op.drop_index(op.f('ix_material_delivery_items_delivery'), table_name='material_delivery_items')
    op.drop_index(op.f('ix_material_delivery_items_id'), table_name='material_delivery_items')
    op.drop_table('material_delivery_items')
    op.drop_index(op.f('ix_material_deliveries_id'), table_name='material_deliveries')
    op.drop_table('material_deliveries')
