"""tickets infra availability

Revision ID: c8a4f2c0f6a9
Revises: a2f6d6839294
Create Date: 2026-01-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c8a4f2c0f6a9"
down_revision: Union[str, Sequence[str], None] = ("a2f6d6839294", "8bc58d283e34")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


new_status_enum = sa.Enum(
    "open",
    "in_progress",
    "pending",
    "pending_infra",
    "resolved",
    "closed",
    name="ticket_status_enum",
    native_enum=False,
)
old_status_enum = sa.Enum(
    "open",
    "pending",
    "resolved",
    "closed",
    name="ticket_status_enum",
    native_enum=False,
)

new_ot_type_enum = sa.Enum(
    "repair",
    "install",
    "pickup",
    "infrastructure",
    name="work_order_type_enum",
    native_enum=False,
)
old_ot_type_enum = sa.Enum(
    "repair",
    "install",
    "pickup",
    name="work_order_type_enum",
    native_enum=False,
)


def upgrade() -> None:
    """Add availability_note and extend enums for infra workflow."""
    with op.batch_alter_table("tickets_v2", schema=None) as batch_op:
        batch_op.add_column(sa.Column("availability_note", sa.Text(), nullable=True))
        batch_op.alter_column(
            "status",
            existing_type=old_status_enum,
            type_=new_status_enum,
            existing_nullable=False,
        )

    with op.batch_alter_table("work_orders", schema=None) as batch_op:
        batch_op.alter_column(
            "ot_type",
            existing_type=old_ot_type_enum,
            type_=new_ot_type_enum,
            existing_nullable=False,
        )


def downgrade() -> None:
    """Rollback availability_note and enum extensions."""
    with op.batch_alter_table("work_orders", schema=None) as batch_op:
        batch_op.alter_column(
            "ot_type",
            existing_type=new_ot_type_enum,
            type_=old_ot_type_enum,
            existing_nullable=False,
        )

    with op.batch_alter_table("tickets_v2", schema=None) as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=new_status_enum,
            type_=old_status_enum,
            existing_nullable=False,
        )
        batch_op.drop_column("availability_note")
