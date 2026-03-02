"""Add coordination fields to work_orders

Revision ID: 2026_02_02_002
Revises: 2026_02_02_001_coordination
Create Date: 2026-02-02 12:00:00.000000

Agrega campos para coordinación de cuadrillas a work_orders:
  - team_id (FK a teams)
  - scheduled_start (datetime con timezone)
  - scheduled_end (datetime con timezone)
  - estimated_duration (int, minutos)
  - coordination_notes (text)

También actualiza el enum WorkOrderStatus para incluir:
  - coordinated (fecha pactada, sin cuadrilla)
  - scheduled (fecha + cuadrilla asignada)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2026_02_02_002'
down_revision = '2026_02_02_001_coordination'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema - agregar campos de coordinación."""
    
    # 1. Actualizar enum work_order_status_enum
    # Primero, convertir la columna a VARCHAR temporalmente
    op.execute("""
        ALTER TABLE work_orders 
        ALTER COLUMN status TYPE VARCHAR(20)
    """)
    
    # Eliminar el enum viejo
    op.execute("DROP TYPE IF EXISTS work_order_status_enum CASCADE")
    
    # Crear enum nuevo con los estados adicionales
    op.execute("""
        CREATE TYPE work_order_status_enum AS ENUM (
            'pending_planning',
            'coordinated',
            'scheduled',
            'assigned',
            'in_progress',
            'completed',
            'failed'
        )
    """)
    
    # Restaurar la columna como enum
    op.execute("""
        ALTER TABLE work_orders
        ALTER COLUMN status TYPE work_order_status_enum
        USING status::work_order_status_enum
    """)
    
    # 2. Agregar nuevas columnas
    op.add_column(
        'work_orders',
        sa.Column(
            'team_id',
            sa.Integer(),
            nullable=True,
            comment='Cuadrilla asignada para esta OT (NULL si asignación individual)'
        )
    )
    
    op.add_column(
        'work_orders',
        sa.Column(
            'scheduled_start',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Fecha/hora de inicio pactada con cliente (timezone aware UTC)'
        )
    )
    
    op.add_column(
        'work_orders',
        sa.Column(
            'scheduled_end',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Fecha/hora estimada de finalización (calculada automáticamente)'
        )
    )
    
    op.add_column(
        'work_orders',
        sa.Column(
            'estimated_duration',
            sa.Integer(),
            nullable=False,
            server_default='60',
            comment='Duración estimada de la tarea en minutos (default: 60min)'
        )
    )
    
    op.add_column(
        'work_orders',
        sa.Column(
            'coordination_notes',
            sa.Text(),
            nullable=True,
            comment="Notas para el técnico (ej: 'Llave en portería', 'Llamar antes de llegar')"
        )
    )
    
    # 3. Crear FK constraint
    op.create_foreign_key(
        'fk_work_orders_team_id',
        'work_orders',
        'teams',
        ['team_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # 4. Crear índices
    op.create_index(
        'ix_work_orders_team_id',
        'work_orders',
        ['team_id']
    )
    
    op.create_index(
        'ix_work_orders_scheduled_start',
        'work_orders',
        ['scheduled_start']
    )
    
    op.create_index(
        'ix_work_orders_team_scheduled',
        'work_orders',
        ['team_id', 'scheduled_start']
    )


def downgrade() -> None:
    """Downgrade schema - eliminar campos de coordinación."""
    
    # Eliminar índices
    op.drop_index('ix_work_orders_team_scheduled', table_name='work_orders')
    op.drop_index('ix_work_orders_scheduled_start', table_name='work_orders')
    op.drop_index('ix_work_orders_team_id', table_name='work_orders')
    
    # Eliminar FK
    op.drop_constraint('fk_work_orders_team_id', 'work_orders', type_='foreignkey')
    
    # Eliminar columnas
    op.drop_column('work_orders', 'coordination_notes')
    op.drop_column('work_orders', 'estimated_duration')
    op.drop_column('work_orders', 'scheduled_end')
    op.drop_column('work_orders', 'scheduled_start')
    op.drop_column('work_orders', 'team_id')
    
    # Restaurar enum original
    op.execute("""
        ALTER TABLE work_orders 
        ALTER COLUMN status TYPE VARCHAR(20)
    """)
    
    op.execute("DROP TYPE IF EXISTS work_order_status_enum CASCADE")
    
    op.execute("""
        CREATE TYPE work_order_status_enum AS ENUM (
            'pending_planning',
            'assigned',
            'in_progress',
            'completed',
            'failed'
        )
    """)
    
    op.execute("""
        ALTER TABLE work_orders
        ALTER COLUMN status TYPE work_order_status_enum
        USING status::work_order_status_enum
    """)
