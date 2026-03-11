"""expand_vehicle_inspections_checklist

Revision ID: 2026_03_11_001
Revises: 2026_03_10_001
Create Date: 2026-03-11 13:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2026_03_11_001"
down_revision: Union[str, Sequence[str], None] = "2026_03_10_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Expand vehicle inspection checklist with operational fields."""
    op.add_column("vehicle_inspections", sa.Column("mechanical_conditions", sa.Text(), nullable=True))

    op.add_column("vehicle_inspections", sa.Column("oil_level", sa.String(length=10), nullable=False, server_default="medio"))
    op.add_column("vehicle_inspections", sa.Column("water_level", sa.String(length=10), nullable=False, server_default="medio"))
    op.add_column("vehicle_inspections", sa.Column("fuel_level", sa.String(length=10), nullable=False, server_default="medio"))
    op.add_column("vehicle_inspections", sa.Column("brake_fluid_level", sa.String(length=10), nullable=False, server_default="medio"))

    op.add_column("vehicle_inspections", sa.Column("has_hydraulic_leaks", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("pulls_to_one_side", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("oil_leaks", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("hose_leaks", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("radiator_leaks", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.add_column("vehicle_inspections", sa.Column("low_beam_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("high_beam_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("hazard_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("brake_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("position_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("reverse_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("fog_lights_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("dashboard_indicators_on", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("reverse_alarm_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    op.add_column("vehicle_inspections", sa.Column("tires_cuts_or_bulges", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("vehicle_inspections", sa.Column("has_spare_tire", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("has_lug_wrench", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("has_jack", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("tires_pressure_ok_30psi", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    op.add_column("vehicle_inspections", sa.Column("seatbelts_all_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("horn_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("mirrors_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("has_two_safety_cones", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("fire_extinguisher_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("vehicle_inspections", sa.Column("wipers_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    op.create_check_constraint(
        "ck_vehicle_inspections_oil_level_values",
        "vehicle_inspections",
        "oil_level IN ('bajo', 'minimo', 'medio', 'alto')",
    )
    op.create_check_constraint(
        "ck_vehicle_inspections_water_level_values",
        "vehicle_inspections",
        "water_level IN ('bajo', 'minimo', 'medio', 'alto')",
    )
    op.create_check_constraint(
        "ck_vehicle_inspections_fuel_level_values",
        "vehicle_inspections",
        "fuel_level IN ('bajo', 'minimo', 'medio', 'alto')",
    )
    op.create_check_constraint(
        "ck_vehicle_inspections_brake_fluid_level_values",
        "vehicle_inspections",
        "brake_fluid_level IN ('bajo', 'minimo', 'medio', 'alto')",
    )


def downgrade() -> None:
    """Rollback expanded vehicle inspection checklist fields."""
    op.drop_constraint("ck_vehicle_inspections_brake_fluid_level_values", "vehicle_inspections", type_="check")
    op.drop_constraint("ck_vehicle_inspections_fuel_level_values", "vehicle_inspections", type_="check")
    op.drop_constraint("ck_vehicle_inspections_water_level_values", "vehicle_inspections", type_="check")
    op.drop_constraint("ck_vehicle_inspections_oil_level_values", "vehicle_inspections", type_="check")

    op.drop_column("vehicle_inspections", "wipers_ok")
    op.drop_column("vehicle_inspections", "fire_extinguisher_ok")
    op.drop_column("vehicle_inspections", "has_two_safety_cones")
    op.drop_column("vehicle_inspections", "mirrors_ok")
    op.drop_column("vehicle_inspections", "horn_ok")
    op.drop_column("vehicle_inspections", "seatbelts_all_ok")

    op.drop_column("vehicle_inspections", "tires_pressure_ok_30psi")
    op.drop_column("vehicle_inspections", "has_jack")
    op.drop_column("vehicle_inspections", "has_lug_wrench")
    op.drop_column("vehicle_inspections", "has_spare_tire")
    op.drop_column("vehicle_inspections", "tires_cuts_or_bulges")

    op.drop_column("vehicle_inspections", "reverse_alarm_ok")
    op.drop_column("vehicle_inspections", "dashboard_indicators_on")
    op.drop_column("vehicle_inspections", "fog_lights_ok")
    op.drop_column("vehicle_inspections", "reverse_lights_ok")
    op.drop_column("vehicle_inspections", "position_lights_ok")
    op.drop_column("vehicle_inspections", "brake_lights_ok")
    op.drop_column("vehicle_inspections", "hazard_lights_ok")
    op.drop_column("vehicle_inspections", "high_beam_lights_ok")
    op.drop_column("vehicle_inspections", "low_beam_lights_ok")

    op.drop_column("vehicle_inspections", "radiator_leaks")
    op.drop_column("vehicle_inspections", "hose_leaks")
    op.drop_column("vehicle_inspections", "oil_leaks")
    op.drop_column("vehicle_inspections", "pulls_to_one_side")
    op.drop_column("vehicle_inspections", "has_hydraulic_leaks")

    op.drop_column("vehicle_inspections", "brake_fluid_level")
    op.drop_column("vehicle_inspections", "fuel_level")
    op.drop_column("vehicle_inspections", "water_level")
    op.drop_column("vehicle_inspections", "oil_level")
    op.drop_column("vehicle_inspections", "mechanical_conditions")
