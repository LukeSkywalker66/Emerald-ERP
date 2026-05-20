"""create_work_order_types_table

Revision ID: 2026_05_20_001
Revises: df251a6435bc
Create Date: 2026-05-20 18:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2026_05_20_001"
down_revision: Union[str, Sequence[str], None] = "df251a6435bc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create work_order_types table and seed initial data."""
    op.create_table(
        "work_order_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=50), nullable=False, server_default="bg-zinc-600"),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_work_order_types_code"),
    )

    op.create_index(op.f("ix_work_order_types_id"), "work_order_types", ["id"], unique=False)
    op.create_index(op.f("ix_work_order_types_code"), "work_order_types", ["code"], unique=True)
    op.create_index(op.f("ix_work_order_types_is_active"), "work_order_types", ["is_active"], unique=False)

    # Seed the 4 initial work order types matching WorkOrderType enum
    op.execute(
        """
        INSERT INTO work_order_types (code, name, description, color, icon, is_active) VALUES
        ('repair', 'Reparación', 'Orden de trabajo para reparaciones técnicas', 'bg-amber-600/80', 'Wrench', true),
        ('install', 'Instalación', 'Orden de trabajo para instalaciones nuevas', 'bg-emerald-600/80', 'Package', true),
        ('pickup', 'Retiro', 'Orden de trabajo para retiro de equipamiento', 'bg-blue-600/80', 'ArrowUpFromLine', true),
        ('infrastructure', 'Infraestructura', 'Orden de trabajo para tareas de infraestructura', 'bg-purple-600/80', 'Building2', true)
        """
    )


def downgrade() -> None:
    """Drop work_order_types table."""
    op.drop_index(op.f("ix_work_order_types_is_active"), table_name="work_order_types")
    op.drop_index(op.f("ix_work_order_types_code"), table_name="work_order_types")
    op.drop_index(op.f("ix_work_order_types_id"), table_name="work_order_types")
    op.drop_table("work_order_types")
