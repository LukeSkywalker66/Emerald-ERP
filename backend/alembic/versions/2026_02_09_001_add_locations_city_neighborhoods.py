"""add_locations_city_neighborhoods

Revision ID: 2026_02_09_001
Revises: 2026_02_02_002
Create Date: 2026-02-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "2026_02_09_001"
down_revision: Union[str, Sequence[str], None] = "2026_02_02_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("zone_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_cities_name"),
    )
    op.create_index("ix_cities_name", "cities", ["name"], unique=False)

    op.create_table(
        "neighborhoods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("city_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["city_id"], ["cities.id"], name="fk_neighborhoods_city_id_cities"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("city_id", "name", name="uq_neighborhoods_city_id_name"),
    )
    op.create_index("ix_neighborhoods_name", "neighborhoods", ["name"], unique=False)
    op.create_index("ix_neighborhoods_city_id", "neighborhoods", ["city_id"], unique=False)

    op.add_column("connections", sa.Column("city_id", sa.Integer(), nullable=True))
    op.add_column("connections", sa.Column("neighborhood_id", sa.Integer(), nullable=True))
    op.create_index("ix_connections_city_id", "connections", ["city_id"], unique=False)
    op.create_index("ix_connections_neighborhood_id", "connections", ["neighborhood_id"], unique=False)
    op.create_foreign_key(
        "fk_connections_city_id_cities",
        "connections",
        "cities",
        ["city_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_connections_neighborhood_id_neighborhoods",
        "connections",
        "neighborhoods",
        ["neighborhood_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_connections_neighborhood_id_neighborhoods", "connections", type_="foreignkey")
    op.drop_constraint("fk_connections_city_id_cities", "connections", type_="foreignkey")
    op.drop_index("ix_connections_neighborhood_id", table_name="connections")
    op.drop_index("ix_connections_city_id", table_name="connections")
    op.drop_column("connections", "neighborhood_id")
    op.drop_column("connections", "city_id")

    op.drop_index("ix_neighborhoods_city_id", table_name="neighborhoods")
    op.drop_index("ix_neighborhoods_name", table_name="neighborhoods")
    op.drop_table("neighborhoods")

    op.drop_index("ix_cities_name", table_name="cities")
    op.drop_table("cities")
