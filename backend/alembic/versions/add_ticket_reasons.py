"""Add ticket_reasons table and ticket_reason_id

Revision ID: add_ticket_reasons
Revises: k0l1m2n3o4p5q
Create Date: 2026-01-22 21:39:13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_ticket_reasons'
down_revision: Union[str, Sequence[str], None] = 'k0l1m2n3o4p5q'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar tabla ticket_reasons y columna ticket_reason_id a tickets."""
    
    # Crear tabla ticket_reasons
    op.create_table(
        'ticket_reasons',
        sa.Column('id', sa.Integer(), nullable=False, comment='ID único del motivo'),
        sa.Column('name', sa.String(length=150), nullable=False, comment='Nombre del motivo'),
        sa.Column('category_id', sa.Integer(), nullable=False, comment='Categoría a la que pertenece el motivo'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['ticket_categories.id'], name='fk_ticket_reasons_category_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ticket_reasons_id', 'ticket_reasons', ['id'])
    op.create_index('ix_ticket_reasons_category_id', 'ticket_reasons', ['category_id'])
    
    # Agregar columna ticket_reason_id a tabla tickets
    op.add_column('tickets', sa.Column('ticket_reason_id', sa.Integer(), nullable=True))
    op.create_index('ix_tickets_ticket_reason_id', 'tickets', ['ticket_reason_id'])
    op.create_foreign_key(
        'fk_tickets_reason_id',
        'tickets',
        'ticket_reasons',
        ['ticket_reason_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Eliminar ticket_reason_id de tickets y tabla ticket_reasons."""
    
    # Eliminar columna y foreign key de tickets
    op.drop_constraint('fk_tickets_reason_id', 'tickets', type_='foreignkey')
    op.drop_index('ix_tickets_ticket_reason_id', table_name='tickets')
    op.drop_column('tickets', 'ticket_reason_id')
    
    # Eliminar tabla ticket_reasons
    op.drop_index('ix_ticket_reasons_category_id', table_name='ticket_reasons')
    op.drop_index('ix_ticket_reasons_id', table_name='ticket_reasons')
    op.drop_table('ticket_reasons')
