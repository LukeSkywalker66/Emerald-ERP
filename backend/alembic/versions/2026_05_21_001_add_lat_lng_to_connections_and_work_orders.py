"""add_lat_lng_to_connections_and_work_orders

Revision ID: 2026_05_21_001
Revises: 2026_05_20_002
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2026_05_21_001"
down_revision: Union[str, Sequence[str], None] = "2026_05_20_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add latitude/longitude columns to connections and work_orders tables."""
    # Connections table
    op.add_column(
        "connections",
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True,
                  comment="Latitud de la dirección de la conexión"),
    )
    op.add_column(
        "connections",
        sa.Column("longitude", sa.Numeric(10, 8), nullable=True,
                  comment="Longitud de la dirección de la conexión"),
    )

    # Work orders table
    op.add_column(
        "work_orders",
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True,
                  comment="Latitud para geolocalización de la dirección"),
    )
    op.add_column(
        "work_orders",
        sa.Column("longitude", sa.Numeric(10, 8), nullable=True,
                  comment="Longitud para geolocalización de la dirección"),
    )


def downgrade() -> None:
    """Drop latitude/longitude columns from both tables."""
    op.drop_column("work_orders", "longitude")
    op.drop_column("work_orders", "latitude")
    op.drop_column("connections", "longitude")
    op.drop_column("connections", "latitude")
