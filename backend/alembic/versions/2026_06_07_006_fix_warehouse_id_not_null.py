"""fix_warehouse_id_not_null_in_db_schema

Vuelve warehouse_id a NOT NULL en serial_items.
Los equipos instalados en cliente se mueven al warehouse VIRTUAL (ID 5).

Revision ID: 2026_06_07_006
Revises: 2026_06_07_005
"""

from alembic import op
import sqlalchemy as sa

revision = '2026_06_07_006'
down_revision = '2026_06_07_005'
branch_labels = None
depends_on = None


def upgrade():
    # Asegurar que no hay NULLs antes de cambiar la constraint
    op.execute("""
        UPDATE serial_items 
        SET warehouse_id = (SELECT id FROM warehouses WHERE type = 'VIRTUAL' LIMIT 1)
        WHERE warehouse_id IS NULL
    """)
    # Cambiar nullable=False en la BD
    op.alter_column('serial_items', 'warehouse_id',
                    existing_type=sa.Integer(),
                    nullable=False,
                    existing_comment="Ubicación actual del item. CENTRAL/MOBILE/VIRTUAL (instalado en cliente)")
    # Restaurar RESTRICT ondelete
    try:
        op.drop_constraint('serial_items_warehouse_id_fkey', 'serial_items', type_='foreignkey')
    except Exception:
        pass
    try:
        op.create_foreign_key('serial_items_warehouse_id_fkey',
                              'serial_items', 'warehouses',
                              ['warehouse_id'], ['id'],
                              ondelete='RESTRICT')
    except Exception:
        pass


def downgrade():
    op.alter_column('serial_items', 'warehouse_id',
                    existing_type=sa.Integer(),
                    nullable=True)
