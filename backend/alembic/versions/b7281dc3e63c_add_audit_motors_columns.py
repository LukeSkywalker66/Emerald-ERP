"""add_audit_motors_columns

Revision ID: b7281dc3e63c
Revises: 2026_03_04_001
Create Date: 2026-03-09 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7281dc3e63c'
down_revision: Union[str, Sequence[str], None] = '2026_03_04_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add audit columns for universal motor."""
    # Add new columns to audit_logs table
    op.add_column('audit_logs', sa.Column('entity_name', sa.String(length=100), nullable=True, comment='Nombre de la entidad afectada (warehouses, tickets, users, etc.)'))
    op.add_column('audit_logs', sa.Column('old_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Valores anteriores del registro (antes de la mutación)'))
    op.add_column('audit_logs', sa.Column('new_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Valores nuevos del registro (después de la mutación)'))
    
    # Set default values for entity_name from existing entity_type data
    op.execute("UPDATE audit_logs SET entity_name = COALESCE(entity_type, 'unknown') WHERE entity_name IS NULL")
    
    # Make entity_name NOT NULL after setting values
    op.alter_column('audit_logs', 'entity_name', existing_type=sa.String(length=100), nullable=False)
    
    # Create indices for better query performance
    op.create_index(op.f('ix_audit_logs_entity_name'), 'audit_logs', ['entity_name'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Remove audit columns."""
    op.drop_index(op.f('ix_audit_logs_entity_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entity_name'), table_name='audit_logs')
    op.drop_column('audit_logs', 'new_values')
    op.drop_column('audit_logs', 'old_values')
    op.drop_column('audit_logs', 'entity_name')
