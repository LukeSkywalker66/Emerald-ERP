"""Fix ticket status column length

Revision ID: k0l1m2n3o4p5q
Revises: j9k0l1m2n3o4p
Create Date: 2026-01-16 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'k0l1m2n3o4p5q'
down_revision = 'j9k0l1m2n3o4p'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Ampliar columna status de tickets para soportar nuevos valores.
    
    Cambio: VARCHAR(13) → VARCHAR(25)
    Razón: "waiting_internal" (16) y "attention_required" (19) no caben en 13
    """
    # Ampliar columna status
    op.execute("ALTER TABLE tickets ALTER COLUMN status TYPE VARCHAR(25)")


def downgrade() -> None:
    """
    Revertir columna status a longitud original.
    
    ADVERTENCIA: Puede fallar si hay valores largos en la columna.
    """
    op.execute("ALTER TABLE tickets ALTER COLUMN status TYPE VARCHAR(13)")
