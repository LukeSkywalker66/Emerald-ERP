"""fleet_refactor_vehicle_model

Refactor de arquitectura Fleet:
- Separa Vehicle (activo físico) de Warehouse (contenedor de inventario)
- Migra warehouses MOBILE existentes a vehicles
- Actualiza teams.vehicle_id para que sea FK correcta a vehicles.id

Revision ID: e531d3d1fe20
Revises: 0f8c172a0f1e
Create Date: 2026-02-28 14:55:28.639274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e531d3d1fe20'
down_revision: Union[str, Sequence[str], None] = '0f8c172a0f1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # 1. Crear enum VehicleStatus (si no existe)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status_enum') THEN
                CREATE TYPE vehicle_status_enum AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED', 'DONATED');
            END IF;
        END $$;
    """)
    
    # 2. Crear tabla vehicles
    op.create_table(
        'vehicles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False, comment='Nombre descriptivo del vehículo'),
        sa.Column('license_plate', sa.String(length=20), nullable=True, comment='Patente del vehículo'),
        sa.Column('vehicle_brand', sa.String(length=50), nullable=True, comment='Marca (ej: Ford, Chevrolet)'),
        sa.Column('vehicle_model', sa.String(length=50), nullable=True, comment='Modelo (ej: Ranger, S10)'),
        sa.Column('vehicle_year', sa.Integer(), nullable=True, comment='Año de fabricación'),
        sa.Column(
            'status',
            postgresql.ENUM('ACTIVE', 'MAINTENANCE', 'RETIRED', 'DONATED', name='vehicle_status_enum', create_type=False),
            nullable=False,
            server_default='ACTIVE',
            comment='Estado operativo del vehículo'
        ),
        sa.Column('warehouse_id', sa.Integer(), nullable=False, comment='FK al warehouse (tipo MOBILE) asociado'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('vehicle_year >= 1900 AND vehicle_year <= 2200', name='ck_vehicle_year_range')
    )
    op.create_index('ix_vehicles_license_plate', 'vehicles', ['license_plate'], unique=True)
    op.create_index('ix_vehicles_warehouse_id', 'vehicles', ['warehouse_id'])
    op.create_index('ix_vehicles_status', 'vehicles', ['status'])
    
    # 3. Migrar datos: Crear vehicles a partir de warehouses tipo MOBILE
    # Para cada warehouse MOBILE, creamos un vehículo apuntando a ese warehouse
    op.execute("""
        INSERT INTO vehicles (name, license_plate, warehouse_id, status, created_at, updated_at)
        SELECT 
            w.name,
            NULL as license_plate,  -- los warehouses MOBILE legacy no tienen patente
            w.id as warehouse_id,
            'ACTIVE' as status,
            w.created_at,
            w.updated_at
        FROM warehouses w
        WHERE w.type = 'MOBILE'
    """)
    
    # 4. Actualizar teams.vehicle_id para que apunte al nuevo vehicle.id
    # Antes: teams.vehicle_id era un Integer sin FK (asumiendo que apuntaba a warehouse.id)
    # Ahora: debe apuntar a vehicles.id
    
    # 4.1. Crear columna temporal vehicle_id_new con FK
    op.add_column('teams', sa.Column('vehicle_id_new', sa.Integer(), nullable=True))
    
    # 4.2. Copiar valores: Si team.vehicle_id apuntaba a warehouse.id, ahora debe apuntar a vehicle.id
    # Matcheamos por warehouse_id: vehicles.warehouse_id = teams.vehicle_id (old)
    op.execute("""
        UPDATE teams t
        SET vehicle_id_new = v.id
        FROM vehicles v
        WHERE v.warehouse_id = t.vehicle_id
    """)
    
    # 4.3. Eliminar columna vieja y renombrar la nueva
    op.drop_column('teams', 'vehicle_id')
    op.alter_column('teams', 'vehicle_id_new', new_column_name='vehicle_id')
    
    # 4.4. Crear FK constraint en teams.vehicle_id -> vehicles.id
    op.create_foreign_key(
        'fk_teams_vehicle_id',
        'teams', 'vehicles',
        ['vehicle_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_teams_vehicle_id', 'teams', ['vehicle_id'])


def downgrade() -> None:
    """Downgrade schema."""
    
    # Revertir FK y columna de teams
    op.drop_constraint('fk_teams_vehicle_id', 'teams', type_='foreignkey')
    op.drop_index('ix_teams_vehicle_id', 'teams')
    
    # Restaurar teams.vehicle_id como Integer sin FK (apuntando a warehouse.id)
    op.add_column('teams', sa.Column('vehicle_id_old', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE teams t
        SET vehicle_id_old = v.warehouse_id
        FROM vehicles v
        WHERE v.id = t.vehicle_id
    """)
    op.drop_column('teams', 'vehicle_id')
    op.alter_column('teams', 'vehicle_id_old', new_column_name='vehicle_id')
    
    # Eliminar tabla vehicles
    op.drop_index('ix_vehicles_status', 'vehicles')
    op.drop_index('ix_vehicles_warehouse_id', 'vehicles')
    op.drop_index('ix_vehicles_license_plate', 'vehicles')
    op.drop_table('vehicles')
    
    # Eliminar enum
    op.execute("DROP TYPE vehicle_status_enum")
