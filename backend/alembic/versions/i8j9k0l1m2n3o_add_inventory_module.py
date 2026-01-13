"""Add inventory module with warehouses, products, stock tracking and serial items.

Revision ID: i8j9k0l1m2n3o
Revises: h7f8a9e2b5c3d
Create Date: 2026-01-12 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i8j9k0l1m2n3o'
down_revision = 'h7f8a9e2b5c3d'
branch_labels = None
depends_on = None


def upgrade():
    # Crear enums para inventory
    op.execute("""
        CREATE TYPE warehouse_type_enum AS ENUM ('CENTRAL', 'MOBILE', 'VIRTUAL')
    """)
    
    op.execute("""
        CREATE TYPE product_type_enum AS ENUM ('SERIALIZED', 'BULK')
    """)
    
    op.execute("""
        CREATE TYPE serial_item_status_enum AS ENUM ('NEW', 'USED', 'DAMAGED', 'INSTALLED')
    """)
    
    op.execute("""
        CREATE TYPE movement_type_enum AS ENUM (
            'PURCHASE', 'TRANSFER', 'CONSUMPTION', 'RECOVERY', 'ADJUSTMENT'
        )
    """)
    
    # Tabla: warehouses (depósitos/ubicaciones)
    op.create_table(
        'warehouses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column(
            'type',
            postgresql.ENUM('CENTRAL', 'MOBILE', 'VIRTUAL', name='warehouse_type_enum', create_type=False),
            nullable=False,
            comment='CENTRAL: depósito principal, MOBILE: camioneta de técnico, VIRTUAL: bajas/perdidos/clientes'
        ),
        sa.Column('user_id', sa.Integer(), nullable=True, comment='FK a usuario si es tipo MOBILE (técnico asignado)'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_warehouses_type', 'warehouses', ['type'])
    op.create_index('ix_warehouses_user_id', 'warehouses', ['user_id'])
    
    # Tabla: products (catálogo de productos)
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('sku', sa.String(length=50), nullable=False, unique=True, comment='Código corto único'),
        sa.Column(
            'type',
            postgresql.ENUM('SERIALIZED', 'BULK', name='product_type_enum', create_type=False),
            nullable=False,
            comment='SERIALIZED: equipos con serial único, BULK: materiales a granel (metros, unidades sin serial)'
        ),
        sa.Column('category', sa.String(length=100), nullable=True, comment='Ej: ONU, CABLE, HERRAMIENTA'),
        sa.Column('min_stock_alert', sa.Integer(), nullable=True, server_default='0', comment='Cantidad mínima antes de alertar'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_products_sku', 'products', ['sku'], unique=True)
    op.create_index('ix_products_type', 'products', ['type'])
    op.create_index('ix_products_category', 'products', ['category'])
    
    # Tabla: stock_bulk (existencias a granel por almacén)
    op.create_table(
        'stock_bulk',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='0', comment='Puede ser metros de cable, unidades, etc.'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('warehouse_id', 'product_id', name='uq_stock_bulk_warehouse_product')
    )
    op.create_index('ix_stock_bulk_warehouse_id', 'stock_bulk', ['warehouse_id'])
    op.create_index('ix_stock_bulk_product_id', 'stock_bulk', ['product_id'])
    
    # Tabla: serial_items (equipos con serial único)
    op.create_table(
        'serial_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('serial_number', sa.String(length=100), nullable=False, unique=True),
        sa.Column('mac_address', sa.String(length=17), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False, comment='Ubicación actual del item'),
        sa.Column(
            'status',
            postgresql.ENUM('NEW', 'USED', 'DAMAGED', 'INSTALLED', name='serial_item_status_enum', create_type=False),
            nullable=False,
            server_default='NEW'
        ),
        sa.Column('ticket_related_id', sa.Integer(), nullable=True, comment='Última OT/Ticket donde se usó este item'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['ticket_related_id'], ['tickets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_serial_items_serial_number', 'serial_items', ['serial_number'], unique=True)
    op.create_index('ix_serial_items_warehouse_id', 'serial_items', ['warehouse_id'])
    op.create_index('ix_serial_items_product_id', 'serial_items', ['product_id'])
    op.create_index('ix_serial_items_status', 'serial_items', ['status'])
    
    # Tabla: stock_movements (bitácora de auditoría de movimientos)
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('from_warehouse_id', sa.Integer(), nullable=True, comment='Origen del movimiento (null si es compra/alta)'),
        sa.Column('to_warehouse_id', sa.Integer(), nullable=True, comment='Destino del movimiento (null si es baja/consumo)'),
        sa.Column('quantity', sa.Float(), nullable=True, comment='Cantidad si es producto BULK'),
        sa.Column('serial_item_id', sa.Integer(), nullable=True, comment='Serial específico si es producto SERIALIZED'),
        sa.Column(
            'movement_type',
            postgresql.ENUM('PURCHASE', 'TRANSFER', 'CONSUMPTION', 'RECOVERY', 'ADJUSTMENT',
                           name='movement_type_enum', create_type=False),
            nullable=False,
            comment='PURCHASE: compra/ingreso, TRANSFER: traspaso, CONSUMPTION: uso en OT, RECOVERY: recupero de campo, ADJUSTMENT: ajuste de inventario'
        ),
        sa.Column('reference', sa.String(length=200), nullable=True, comment='Ej: "OT #123", "Remito #50", "Ajuste manual"'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='Usuario que realizó el movimiento'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['from_warehouse_id'], ['warehouses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['to_warehouse_id'], ['warehouses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['serial_item_id'], ['serial_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stock_movements_date', 'stock_movements', ['date'])
    op.create_index('ix_stock_movements_product_id', 'stock_movements', ['product_id'])
    op.create_index('ix_stock_movements_from_warehouse_id', 'stock_movements', ['from_warehouse_id'])
    op.create_index('ix_stock_movements_to_warehouse_id', 'stock_movements', ['to_warehouse_id'])
    op.create_index('ix_stock_movements_movement_type', 'stock_movements', ['movement_type'])
    op.create_index('ix_stock_movements_user_id', 'stock_movements', ['user_id'])


def downgrade():
    # Eliminar tablas en orden inverso
    op.drop_table('stock_movements')
    op.drop_table('serial_items')
    op.drop_table('stock_bulk')
    op.drop_table('products')
    op.drop_table('warehouses')
    
    # Eliminar enums
    op.execute('DROP TYPE IF EXISTS movement_type_enum')
    op.execute('DROP TYPE IF EXISTS serial_item_status_enum')
    op.execute('DROP TYPE IF EXISTS product_type_enum')
    op.execute('DROP TYPE IF EXISTS warehouse_type_enum')
