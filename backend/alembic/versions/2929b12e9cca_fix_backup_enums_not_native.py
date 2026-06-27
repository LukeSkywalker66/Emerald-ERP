"""fix_backup_enums_not_native

Revision ID: 2929b12e9cca
Revises: 2026_06_25_002_backup_minio
Create Date: 2026-06-25 22:46:16.459429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2929b12e9cca'
down_revision: Union[str, Sequence[str], None] = '2026_06_25_002_backup_minio'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Cambiar backup_runs.status y backup_runs.triggered_by
    de enum nativo PostgreSQL a VARCHAR para evitar restricciones.
    """
    # Cambiar status de enum nativo a VARCHAR
    op.alter_column(
        'backup_runs',
        'status',
        existing_type=sa.Enum('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', name='backupstatus'),
        type_=sa.String(20),
        existing_nullable=False,
    )
    
    # Cambiar triggered_by de enum nativo a VARCHAR
    op.alter_column(
        'backup_runs',
        'triggered_by',
        existing_type=sa.Enum('SCHEDULED', 'MANUAL', name='backuptrigger'),
        type_=sa.String(20),
        existing_nullable=False,
    )
    
    # Intentar dropear los tipos enum
    try:
        op.execute('DROP TYPE IF EXISTS backupstatus CASCADE')
        op.execute('DROP TYPE IF EXISTS backuptrigger CASCADE')
    except Exception:
        pass


def downgrade() -> None:
    """Revert to enum types."""
    # Recrear los tipos enum
    op.execute("""
        CREATE TYPE backupstatus AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')
    """)
    op.execute("""
        CREATE TYPE backuptrigger AS ENUM ('SCHEDULED', 'MANUAL')
    """)
    
    # Cambiar de nuevo a enum
    op.alter_column(
        'backup_runs',
        'status',
        existing_type=sa.String(20),
        type_=sa.Enum('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', name='backupstatus'),
        existing_nullable=False,
    )
    
    op.alter_column(
        'backup_runs',
        'triggered_by',
        existing_type=sa.String(20),
        type_=sa.Enum('SCHEDULED', 'MANUAL', name='backuptrigger'),
        existing_nullable=False,
    )
