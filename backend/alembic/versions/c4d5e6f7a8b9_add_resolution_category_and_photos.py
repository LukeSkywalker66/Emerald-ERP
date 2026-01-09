"""Add resolution_category and photo_urls to work_orders.

Revision ID: c4d5e6f7a8b9
Revises: b9b68ddfc7de
Create Date: 2026-01-07 13:00:00.000000

Agrega dos campos a work_orders para capturar:
  - Categoría de resolución (infrastructure, equipment, configuration, other)
  - URLs de fotos de evidencia (JSONB array)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = 'b9b68ddfc7de'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Crear enum type para resolution_category
    # (Si ya existe desde una migración anterior, this won't fail)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE resolution_category_enum AS ENUM (
                'infrastructure',
                'equipment',
                'configuration',
                'other'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # 2. Agregar columna resolution_category
    op.add_column(
        'work_orders',
        sa.Column(
            'resolution_category',
            sa.Enum('infrastructure', 'equipment', 'configuration', 'other', 
                    name='resolution_category_enum', native_enum=False),
            nullable=True,
            comment='Categoría de resolución: infrastructure, equipment, configuration, other'
        )
    )
    
    # 3. Agregar columna photo_urls (JSONB)
    op.add_column(
        'work_orders',
        sa.Column(
            'photo_urls',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default='[]',
            comment='Array de URLs de fotos de evidencia'
        )
    )


def downgrade() -> None:
    # Remover columnas
    op.drop_column('work_orders', 'photo_urls')
    op.drop_column('work_orders', 'resolution_category')
    
    # Remover tipo enum (solo si no lo usa otra tabla)
    op.execute("""
        DO $$ BEGIN
            DROP TYPE IF EXISTS resolution_category_enum;
        EXCEPTION
            WHEN others THEN null;
        END $$;
    """)
