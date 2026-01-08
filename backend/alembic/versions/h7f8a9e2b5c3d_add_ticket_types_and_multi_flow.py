"""Add ticket types and multi-flow support.

Revision ID: h7f8a9e2b5c3d
Revises: g6e7f4d3c0b1a
Create Date: 2026-01-08 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'h7f8a9e2b5c3d'
down_revision = 'g6e7f4d3c0b1a'
branch_labels = None
depends_on = None


def upgrade():
    # Crear enums
    op.execute("""
        CREATE TYPE ticket_type_enum AS ENUM (
            'technical', 'installation', 'withdrawal', 'relocation', 'administrative'
        )
    """)
    
    op.execute("""
        CREATE TYPE administrative_subtype_enum AS ENUM (
            'billing', 'data_update', 'plan_change', 'other'
        )
    """)
    
    # Agregar columnas a tabla tickets
    op.add_column(
        'tickets',
        sa.Column(
            'ticket_type',
            postgresql.ENUM('technical', 'installation', 'withdrawal', 'relocation', 'administrative',
                           name='ticket_type_enum', create_type=False),
            nullable=False,
            server_default='technical',
            comment='Tipo de flujo: technical, installation, withdrawal, relocation, administrative'
        )
    )
    
    op.add_column(
        'tickets',
        sa.Column(
            'administrative_subtype',
            postgresql.ENUM('billing', 'data_update', 'plan_change', 'other',
                           name='administrative_subtype_enum', create_type=False),
            nullable=True,
            comment='Subtipo para tickets administrativos: billing, data_update, plan_change, other'
        )
    )
    
    op.add_column(
        'tickets',
        sa.Column(
            'origin_connection_id',
            sa.Integer(),
            nullable=True,
            comment='FK soft a conexión de origen (para RELOCATION)'
        )
    )
    
    op.add_column(
        'tickets',
        sa.Column(
            'destination_connection_id',
            sa.Integer(),
            nullable=True,
            comment='FK soft a conexión de destino (para RELOCATION, INSTALLATION)'
        )
    )
    
    op.add_column(
        'tickets',
        sa.Column(
            'installation_tech',
            sa.String(50),
            nullable=True,
            comment='Tecnología de instalación: fiber, wireless, hybrid (para INSTALLATION)'
        )
    )
    
    # Crear índices
    op.create_index('ix_tickets_ticket_type', 'tickets', ['ticket_type'])
    op.create_index('ix_tickets_origin_connection', 'tickets', ['origin_connection_id'])
    op.create_index('ix_tickets_destination_connection', 'tickets', ['destination_connection_id'])


def downgrade():
    op.drop_index('ix_tickets_destination_connection', 'tickets')
    op.drop_index('ix_tickets_origin_connection', 'tickets')
    op.drop_index('ix_tickets_ticket_type', 'tickets')
    
    op.drop_column('tickets', 'installation_tech')
    op.drop_column('tickets', 'destination_connection_id')
    op.drop_column('tickets', 'origin_connection_id')
    op.drop_column('tickets', 'administrative_subtype')
    op.drop_column('tickets', 'ticket_type')
    
    op.execute('DROP TYPE administrative_subtype_enum')
    op.execute('DROP TYPE ticket_type_enum')
