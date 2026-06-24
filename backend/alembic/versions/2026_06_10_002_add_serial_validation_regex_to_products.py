"""add serial_validation_regex to products

Revision ID: 2026_06_10_002
Revises: 2026_06_09_001
Create Date: 2026-06-10 00:00:00.000000

"""
from __future__ import annotations
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "2026_06_10_002"
down_revision: Union[str, None] = "2026_06_09_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar columna serial_validation_regex a products."""
    op.add_column(
        "products",
        sa.Column(
            "serial_validation_regex",
            sa.String(255),
            nullable=True,
            comment="Regex para validar seriales al ingresar compras. Null = acepta cualquier formato.",
        ),
    )


def downgrade() -> None:
    """Eliminar columna serial_validation_regex de products."""
    op.drop_column("products", "serial_validation_regex")
