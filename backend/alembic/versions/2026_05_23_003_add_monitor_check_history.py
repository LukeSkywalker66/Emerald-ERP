"""add_monitor_check_history

Revision ID: 2026_05_23_003
Revises: 2026_05_23_002
Create Date: 2026-05-23 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ENUM

# revision identifiers, used by Alembic.
revision: str = "2026_05_23_003"
down_revision: Union[str, None] = "2026_05_23_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create monitor_check_history table."""
    op.create_table(
        "monitor_check_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("monitor_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            ENUM("UP", "DOWN", "UNKNOWN", "DEGRADED", name="monitorstatus"),
            nullable=False,
            comment="Estado al momento de la verificación",
        ),
        sa.Column(
            "status_code", sa.Integer(), nullable=True,
            comment="Código de estado (HTTP, exit code, etc.)",
        ),
        sa.Column(
            "response_time_ms", sa.Float(), nullable=True,
            comment="Tiempo de respuesta en milisegundos",
        ),
        sa.Column(
            "error_message", sa.Text(), nullable=True,
            comment="Mensaje de error si la verificación falló",
        ),
        sa.Column(
            "checked_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
            comment="Timestamp de la verificación",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["monitor_id"],
            ["service_monitors.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_monitor_check_history_monitor_id",
        "monitor_check_history",
        ["monitor_id"],
    )
    op.create_index(
        "ix_monitor_check_history_checked_at",
        "monitor_check_history",
        ["checked_at"],
    )
    op.create_index(
        "ix_monitor_check_history_monitor_checked",
        "monitor_check_history",
        ["monitor_id", "checked_at"],
    )


def downgrade() -> None:
    """Drop monitor_check_history table."""
    op.drop_index(
        "ix_monitor_check_history_monitor_checked",
        table_name="monitor_check_history",
    )
    op.drop_index(
        "ix_monitor_check_history_checked_at",
        table_name="monitor_check_history",
    )
    op.drop_index(
        "ix_monitor_check_history_monitor_id",
        table_name="monitor_check_history",
    )
    op.drop_table("monitor_check_history")
