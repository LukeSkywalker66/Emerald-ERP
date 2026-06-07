"""seed_virtual_warehouse_and_keep_warehouse_id_not_null

Decidimos NO hacer warehouse_id nullable en serial_items.
En lugar de NULL, usamos un warehouse VIRTUAL para equipos instalados en cliente.
Esta migration crea el warehouse VIRTUAL si no existe.

Revision ID: 2026_06_07_005
Revises: 2026_06_07_004
"""

from alembic import op
import sqlalchemy as sa

revision = '2026_06_07_005'
down_revision = '2026_06_07_004'
branch_labels = None
depends_on = None


def upgrade():
    # Crear warehouse VIRTUAL si no existe (para equipos instalados en cliente)
    op.execute("""
        INSERT INTO warehouses (name, type, created_at, updated_at)
        SELECT 'Equipos Instalados en Cliente', 'VIRTUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM warehouses WHERE type = 'VIRTUAL'
        )
    """)


def downgrade():
    # Eliminar el warehouse VIRTUAL (solo si no tiene serial_items asociados)
    op.execute("""
        DELETE FROM warehouses
        WHERE type = 'VIRTUAL'
        AND id NOT IN (SELECT DISTINCT warehouse_id FROM serial_items WHERE warehouse_id IS NOT NULL)
    """)
