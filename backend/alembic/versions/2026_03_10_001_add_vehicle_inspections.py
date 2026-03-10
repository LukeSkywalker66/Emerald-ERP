"""add_vehicle_inspections

Revision ID: 2026_03_10_001
Revises: b7281dc3e63c
Create Date: 2026-03-10 01:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2026_03_10_001"
down_revision: Union[str, Sequence[str], None] = "b7281dc3e63c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create vehicle_inspections table."""
    op.create_table(
        "vehicle_inspections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("technician_id", sa.Integer(), nullable=False),
        sa.Column("inspection_date", sa.Date(), nullable=False),
        sa.Column("km_actual", sa.Integer(), nullable=False),
        sa.Column("water_level_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("oil_level_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("tires_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("cleanliness_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("damage_notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="OK"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("km_actual >= 0", name="ck_vehicle_inspections_km_non_negative"),
        sa.CheckConstraint(
            "status IN ('OK', 'NEEDS_ATTENTION', 'CRITICAL')",
            name="ck_vehicle_inspections_status_values",
        ),
        sa.ForeignKeyConstraint(
            ["technician_id"],
            ["users.id"],
            name="fk_vehicle_inspections_technician_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["vehicle_id"],
            ["vehicles.id"],
            name="fk_vehicle_inspections_vehicle_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vehicle_id", "inspection_date", name="uq_vehicle_inspections_vehicle_date"),
    )

    op.create_index(op.f("ix_vehicle_inspections_id"), "vehicle_inspections", ["id"], unique=False)
    op.create_index(op.f("ix_vehicle_inspections_vehicle_id"), "vehicle_inspections", ["vehicle_id"], unique=False)
    op.create_index(op.f("ix_vehicle_inspections_technician_id"), "vehicle_inspections", ["technician_id"], unique=False)
    op.create_index(op.f("ix_vehicle_inspections_inspection_date"), "vehicle_inspections", ["inspection_date"], unique=False)
    op.create_index(op.f("ix_vehicle_inspections_status"), "vehicle_inspections", ["status"], unique=False)


def downgrade() -> None:
    """Drop vehicle_inspections table."""
    op.drop_index(op.f("ix_vehicle_inspections_status"), table_name="vehicle_inspections")
    op.drop_index(op.f("ix_vehicle_inspections_inspection_date"), table_name="vehicle_inspections")
    op.drop_index(op.f("ix_vehicle_inspections_technician_id"), table_name="vehicle_inspections")
    op.drop_index(op.f("ix_vehicle_inspections_vehicle_id"), table_name="vehicle_inspections")
    op.drop_index(op.f("ix_vehicle_inspections_id"), table_name="vehicle_inspections")
    op.drop_table("vehicle_inspections")
