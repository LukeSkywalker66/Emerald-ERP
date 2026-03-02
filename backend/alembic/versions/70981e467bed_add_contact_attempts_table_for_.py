"""add contact attempts table for coordination tracking

Revision ID: 70981e467bed
Revises: 7b7dfe8236f8
Create Date: 2026-02-05 18:58:35.112213

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70981e467bed'
down_revision: Union[str, Sequence[str], None] = '7b7dfe8236f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Crear tabla contact_attempts
    op.create_table(
        'contact_attempts',
        sa.Column('id', sa.Integer(), nullable=False, comment='ID único del intento de contacto'),
        sa.Column('work_order_id', sa.Integer(), nullable=False, comment='OT asociada al intento de contacto'),
        sa.Column('attempted_by', sa.Integer(), nullable=True, comment='Usuario (coordinador) que realizó el intento'),
        sa.Column('result', sa.VARCHAR(length=50), nullable=False, comment='Resultado del intento de contacto'),
        sa.Column('phone_number', sa.String(length=50), nullable=True, comment='Número al que se intentó llamar (snapshot)'),
        sa.Column('notes', sa.Text(), nullable=True, comment='Notas adicionales del coordinador'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), comment='Timestamp del intento'),
        sa.ForeignKeyConstraint(['attempted_by'], ['users.id'], name='fk_contact_attempts_attempted_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], name='fk_contact_attempts_work_order_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Registro de intentos de contacto telefónico con clientes'
    )
    
    # Crear índices
    op.create_index('ix_contact_attempts_id', 'contact_attempts', ['id'])
    op.create_index('ix_contact_attempts_work_order_id', 'contact_attempts', ['work_order_id'])
    op.create_index('ix_contact_attempts_attempted_by', 'contact_attempts', ['attempted_by'])
    op.create_index('ix_contact_attempts_result', 'contact_attempts', ['result'])
    op.create_index('ix_contact_attempts_created_at', 'contact_attempts', ['created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_contact_attempts_created_at', table_name='contact_attempts')
    op.drop_index('ix_contact_attempts_result', table_name='contact_attempts')
    op.drop_index('ix_contact_attempts_attempted_by', table_name='contact_attempts')
    op.drop_index('ix_contact_attempts_work_order_id', table_name='contact_attempts')
    op.drop_index('ix_contact_attempts_id', table_name='contact_attempts')
    op.drop_table('contact_attempts')
    op.execute('DROP TYPE contact_attempt_result_enum')
