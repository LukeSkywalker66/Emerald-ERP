"""add_work_order_execution_fields

Revision ID: b9b68ddfc7de
Revises: 60b46d4e1e39
Create Date: 2026-01-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b9b68ddfc7de'
down_revision: Union[str, Sequence[str], None] = '60b46d4e1e39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - solo agregar campos de ejecución a work_orders."""
    # Crear enum para resolution_type
    op.execute("""
        CREATE TYPE work_order_resolution_type_enum AS ENUM (
            'success', 'failed', 'rescheduled', 'partial'
        )
    """)
    
    # Agregar nuevas columnas a work_orders
    op.add_column('work_orders', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True, comment='Fecha/hora en que el técnico inició el trabajo en sitio'))
    op.add_column('work_orders', sa.Column('resolution_type', sa.Enum('success', 'failed', 'rescheduled', 'partial', name='work_order_resolution_type_enum', native_enum=False), nullable=True, comment='Tipo de resolución: success, failed, rescheduled, partial'))
    op.add_column('work_orders', sa.Column('resolution_notes', sa.Text(), nullable=True, comment='Notas del técnico sobre la resolución final'))
    op.add_column('work_orders', sa.Column('custom_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Datos flexibles del técnico (JSONB): optical_signal_dbm, speedtest, photos, etc.'))
    
    # Actualizar comentarios de columnas existentes
    op.alter_column('work_orders', 'completed_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               comment='Fecha/hora de finalización real del trabajo',
               existing_nullable=True)
    op.alter_column('work_orders', 'notes',
               existing_type=sa.TEXT(),
               comment='Notas del técnico sobre el trabajo realizado (deprecated, usar resolution_notes)',
               existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema - eliminar campos agregados."""
    op.drop_column('work_orders', 'custom_data')
    op.drop_column('work_orders', 'resolution_notes')
    op.drop_column('work_orders', 'resolution_type')
    op.drop_column('work_orders', 'started_at')
    op.execute('DROP TYPE work_order_resolution_type_enum')
    op.alter_column('work_orders', 'completed_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               comment='Fecha/hora de finalización',
               existing_nullable=True)
    op.alter_column('work_orders', 'notes',
               existing_type=sa.TEXT(),
               comment='Notas del técnico sobre el trabajo realizado',
               existing_nullable=True)
