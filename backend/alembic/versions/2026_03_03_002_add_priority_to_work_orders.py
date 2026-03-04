"""add priority to work_orders

Revision ID: 2026_03_03_002
Revises: 2026_03_03_001
Create Date: 2026-03-03 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_03_03_002'
down_revision = '2026_03_03_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Agregar campo priority a work_orders para permitir gestión independiente
    de la criticidad de la OT respecto al ticket padre.
    
    - Hereda inicialmente la priority del ticket
    - Puede modificarse independientemente después
    - Default: 'medium'
    """
    # Agregar columna priority usando el mismo enum que tickets
    op.add_column(
        'work_orders',
        sa.Column(
            'priority',
            sa.Enum('critical', 'high', 'medium', 'low', name='ticket_priority_enum', native_enum=False),
            nullable=False,
            server_default='medium',
            comment='Prioridad de la OT (heredada del ticket, pero modificable independientemente)'
        )
    )
    
    # Crear índice para mejorar queries por prioridad
    op.create_index(
        'ix_work_orders_priority',
        'work_orders',
        ['priority'],
        unique=False
    )
    
    # IMPORTANTE: Sincronizar priority con tickets existentes
    # Para todas las WO que ya existen, copiar la priority de su ticket padre
    op.execute("""
        UPDATE work_orders
        SET priority = tickets.priority
        FROM tickets
        WHERE work_orders.ticket_id = tickets.id
    """)


def downgrade() -> None:
    """Revertir cambios: eliminar columna priority y su índice"""
    op.drop_index('ix_work_orders_priority', table_name='work_orders')
    op.drop_column('work_orders', 'priority')
