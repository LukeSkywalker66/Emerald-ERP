"""Agregar tablas de API Keys y auditoría

Revision ID: 9b4f2c8e1d2a
Revises: 678033205aa3
Create Date: 2025-12-30 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9b4f2c8e1d2a'
down_revision: Union[str, Sequence[str], None] = '678033205aa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Crear tablas de API Keys"""
    
    # Crear tabla api_keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('key_hash', sa.String(), nullable=False),
        sa.Column('key_prefix', sa.String(10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='["read"]'),
        sa.Column('created_by', sa.String(), nullable=True, server_default='system'),
        sa.Column('rotation_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_rotated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices en api_keys
    op.create_index(op.f('ix_api_keys_id'), 'api_keys', ['id'], unique=False)
    op.create_index(op.f('ix_api_keys_name'), 'api_keys', ['name'], unique=False)
    op.create_index(op.f('ix_api_keys_key_prefix'), 'api_keys', ['key_prefix'], unique=False)
    op.create_index(op.f('ix_api_keys_active'), 'api_keys', ['active'], unique=False)
    op.create_index('ix_api_keys_key_hash_unique', 'api_keys', ['key_hash'], unique=True)
    
    # Crear tabla api_key_audit
    op.create_table(
        'api_key_audit',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('api_key_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('endpoint', sa.String(), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices en api_key_audit
    op.create_index(op.f('ix_api_key_audit_id'), 'api_key_audit', ['id'], unique=False)
    op.create_index(op.f('ix_api_key_audit_api_key_id'), 'api_key_audit', ['api_key_id'], unique=False)
    op.create_index(op.f('ix_api_key_audit_timestamp'), 'api_key_audit', ['timestamp'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Eliminar tablas de API Keys"""
    
    # Eliminar índices
    op.drop_index(op.f('ix_api_key_audit_timestamp'), table_name='api_key_audit')
    op.drop_index(op.f('ix_api_key_audit_api_key_id'), table_name='api_key_audit')
    op.drop_index(op.f('ix_api_key_audit_id'), table_name='api_key_audit')
    
    # Eliminar tabla api_key_audit
    op.drop_table('api_key_audit')
    
    # Eliminar índices de api_keys
    op.drop_index('ix_api_keys_key_hash_unique', table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_active'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_prefix'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_name'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_id'), table_name='api_keys')
    
    # Eliminar tabla api_keys
    op.drop_table('api_keys')
