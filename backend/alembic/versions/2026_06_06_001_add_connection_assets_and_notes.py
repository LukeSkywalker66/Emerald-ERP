"""add_connection_assets_and_notes

Revision ID: 2026_06_06_001
Revises: 2026_06_05_001
Create Date: 2026-06-06 10:00:00.000000

Agrega:
  - Tabla connection_assets (trazabilidad de equipos serializados en cliente)
  - Tabla connection_notes (notas de técnicos sobre conexiones)
  - Columna connection_id en serial_items
  - Columna connection_id en work_order_items (histórico BULK)
  - Actualiza CHECK constraint de serial_items.status con nuevos estados
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_06_06_001'
down_revision: Union[str, Sequence[str], None] = '2026_06_05_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # 1. Tabla: connection_assets
    # ============================================================
    op.create_table(
        'connection_assets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('connection_id', sa.Integer(), nullable=False, index=True),
        sa.Column('serial_item_id', sa.Integer(), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('serial_number', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False,
                  server_default='INSTALLED'),
        sa.Column('installed_at', sa.DateTime(), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('removed_at', sa.DateTime(), nullable=True),
        sa.Column('installed_by_wo_id', sa.Integer(), nullable=True),
        sa.Column('removed_by_wo_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['connection_id'], ['connections.connection_id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['serial_item_id'], ['serial_items.id'],
                                ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'],
                                ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['installed_by_wo_id'], ['work_orders.id'],
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['removed_by_wo_id'], ['work_orders.id'],
                                ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('connection_id', 'serial_item_id',
                            name='ix_connection_assets_lookup'),
    )
    op.create_index('ix_connection_assets_id', 'connection_assets', ['id'])

    # ============================================================
    # 2. Tabla: connection_notes
    # ============================================================
    op.create_table(
        'connection_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('connection_id', sa.Integer(), nullable=False, index=True),
        sa.Column('work_order_id', sa.Integer(), nullable=True),
        sa.Column('author_id', sa.Integer(), nullable=True),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('is_pinned', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.text('CURRENT_TIMESTAMP'), index=True),
        sa.ForeignKeyConstraint(['connection_id'], ['connections.connection_id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'],
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'],
                                ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_connection_notes_id', 'connection_notes', ['id'])

    # ============================================================
    # 3. Agregar connection_id a serial_items
    # ============================================================
    op.add_column('serial_items', sa.Column('connection_id', sa.Integer(),
                  nullable=True, index=True))
    op.create_foreign_key(
        'fk_serial_items_connection_id',
        'serial_items', 'connections',
        ['connection_id'], ['connection_id'],
        ondelete='SET NULL',
    )

    # ============================================================
    # 4. Agregar connection_id a work_order_items (histórico BULK)
    # ============================================================
    op.add_column('work_order_items', sa.Column('connection_id', sa.Integer(),
                  nullable=True, index=True))
    op.create_foreign_key(
        'fk_work_order_items_connection_id',
        'work_order_items', 'connections',
        ['connection_id'], ['connection_id'],
        ondelete='SET NULL',
    )

    # ============================================================
    # 5. Actualizar CHECK constraint serial_items.status
    #    (VARCHAR desde migración 2026_06_05_001, no hay enum nativo)
    # ============================================================
    # Como la columna ya es VARCHAR(50), los nuevos valores se insertan
    # directamente. Solo agregamos un CHECK si no existe.
    try:
        op.create_check_constraint(
            'ck_serial_items_status_valid',
            'serial_items',
            sa.text("status IN ('NEW', 'IN_VEHICLE', 'INSTALLED', "
                    "'DEFECTIVE', 'DAMAGED', 'DECOMMISSIONED')"),
        )
    except Exception:
        # El CHECK puede ya existir o la BD no lo soporta
        pass


def downgrade() -> None:
    # Revertir en orden inverso

    # 1. Dropear constraints y columnas
    try:
        op.drop_constraint('fk_work_order_items_connection_id',
                           'work_order_items', type_='foreignkey')
    except Exception:
        pass
    op.drop_column('work_order_items', 'connection_id')

    try:
        op.drop_constraint('fk_serial_items_connection_id',
                           'serial_items', type_='foreignkey')
    except Exception:
        pass
    op.drop_column('serial_items', 'connection_id')

    try:
        op.drop_constraint('ck_serial_items_status_valid',
                           'serial_items', type_='check')
    except Exception:
        pass

    # 2. Dropear tablas
    op.drop_table('connection_notes')
    op.drop_table('connection_assets')
