"""Create installation_types table for scalable installation type management.

Revision ID: 2026_03_03_001
Revises: 2026_02_09_001
Create Date: 2026-03-03 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_03_03_001'
down_revision = '2026_02_09_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'installation_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_installation_types_code')
    )
    op.create_index('ix_installation_types_code', 'installation_types', ['code'])
    op.create_index('ix_installation_types_is_active', 'installation_types', ['is_active'])
    
    # Pre-populate with initial types
    op.execute(
        """
        INSERT INTO installation_types (code, name, description, is_active)
        VALUES
            ('fiber', 'Fibra Óptica (FTTH)', 'Instalación de fibra óptica hasta el hogar. Tecnología de máxima velocidad para usuarios residenciales.', true),
            ('wireless', 'Inalámbrico Dedicado', 'Enlace inalámbrico punto a punto dedicado con equipamiento en azotea. Apto para zonas sin acceso a fibra.', true),
            ('hybrid', 'Híbrido', 'Combinación de fibra e inalámbrico. Fibra hasta nodo + enlace inalámbrico final.', true);
        """
    )


def downgrade() -> None:
    op.drop_table('installation_types')
