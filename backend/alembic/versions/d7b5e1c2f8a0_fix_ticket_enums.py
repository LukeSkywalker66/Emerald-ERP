"""fix ticket enums and availability

Revision ID: d7b5e1c2f8a0
Revises: c8a4f2c0f6a9
Create Date: 2026-01-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d7b5e1c2f8a0"
down_revision: Union[str, Sequence[str], None] = "c8a4f2c0f6a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop old enums and create new ones with correct values."""
    # Eliminar la columna que depende del enum antes
    op.execute("ALTER TABLE tickets_v2 DROP COLUMN IF EXISTS availability_note")
    
    # Actualizar datos a lowercase antes de cambiar enum
    op.execute("UPDATE tickets_v2 SET status = LOWER(status)")
    op.execute("UPDATE work_orders SET ot_type = LOWER(ot_type)")
    
    # Eliminar los enums viejos que tenían valores en UPPERCASE
    op.execute("DROP TYPE IF EXISTS ticket_status_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS work_order_type_enum CASCADE")
    
    # Crear enums nuevos con valores en lowercase
    op.execute("""
        CREATE TYPE ticket_status_enum AS ENUM (
            'open',
            'in_progress',
            'pending',
            'pending_infra',
            'resolved',
            'closed'
        )
    """)
    
    op.execute("""
        CREATE TYPE work_order_type_enum AS ENUM (
            'repair',
            'install',
            'pickup',
            'infrastructure'
        )
    """)
    
    # Aplicar a la tabla tickets_v2 (ahora usa VARCHAR, convertir a ENUM)
    op.execute("""
        ALTER TABLE tickets_v2
        ALTER COLUMN status TYPE ticket_status_enum
        USING status::ticket_status_enum
    """)
    
    # Aplicar a la tabla work_orders
    op.execute("""
        ALTER TABLE work_orders
        ALTER COLUMN ot_type TYPE work_order_type_enum
        USING ot_type::work_order_type_enum
    """)
    
    # Agregar availability_note de nuevo
    op.execute("""
        ALTER TABLE tickets_v2
        ADD COLUMN availability_note TEXT NULL
    """)


def downgrade() -> None:
    """Rollback enums to previous versions."""
    op.execute("DROP TYPE IF EXISTS ticket_status_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS work_order_type_enum CASCADE")
    
    op.execute("""
        CREATE TYPE ticket_status_enum AS ENUM (
            'open',
            'pending',
            'resolved',
            'closed'
        )
    """)
    
    op.execute("""
        CREATE TYPE work_order_type_enum AS ENUM (
            'repair',
            'install',
            'pickup'
        )
    """)
    
    op.execute("""
        ALTER TABLE tickets_v2
        ALTER COLUMN status TYPE ticket_status_enum
        USING status::text::ticket_status_enum
    """)
    
    op.execute("""
        ALTER TABLE work_orders
        ALTER COLUMN ot_type TYPE work_order_type_enum
        USING ot_type::text::work_order_type_enum
    """)
