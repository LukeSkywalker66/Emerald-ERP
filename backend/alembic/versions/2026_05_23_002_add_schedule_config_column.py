"""add_schedule_config_column

Revision ID: 2026_05_23_002
Revises: 2026_05_23_001
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "2026_05_23_002"
down_revision: Union[str, None] = "2026_05_23_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _infer_schedule_config(cron_expression: str) -> dict | None:
    """Infere el schedule_config desde una expresión cron existente."""
    if not cron_expression:
        return None

    cron = cron_expression.strip()
    parts = cron.split()
    if len(parts) != 5:
        return {"type": "custom_cron", "expression": cron}

    minute, hour, dom, month, dow = parts

    # */N * * * * → interval_minutes
    if minute.startswith("*/") and hour == "*" and dom == "*" and month == "*" and dow == "*":
        return {"type": "interval_minutes", "value": int(minute[2:])}

    # 0 */N * * * → interval_hours
    if minute == "0" and hour.startswith("*/") and dom == "*" and month == "*" and dow == "*":
        return {"type": "interval_hours", "value": int(hour[2:])}

    # MM HH * * * → daily
    if dom == "*" and month == "*" and dow == "*":
        if "," in hour:
            times = [f"{h.zfill(2)}:{minute.zfill(2)}" for h in hour.split(",")]
        else:
            times = [f"{hour.zfill(2)}:{minute.zfill(2)}"]
        return {"type": "daily", "times": times}

    # MM HH * * DOW → weekly
    if dom == "*" and month == "*" and dow != "*":
        days = []
        for part in dow.split(","):
            try:
                days.append(int(part))
            except ValueError:
                if "-" in part:
                    start, end = part.split("-")
                    days.extend(range(int(start), int(end) + 1))
        return {
            "type": "weekly",
            "days": sorted(set(days)),
            "time": f"{hour.zfill(2)}:{minute.zfill(2)}",
        }

    return {"type": "custom_cron", "expression": cron}


def upgrade() -> None:
    """Add schedule_config column and backfill from existing cron_expression."""
    # Add the new JSONB column
    op.add_column(
        "scheduled_tasks",
        sa.Column("schedule_config", JSONB, nullable=True),
    )

    # Backfill: infer schedule_config from existing cron_expression
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT id, cron_expression FROM scheduled_tasks "
            "WHERE cron_expression IS NOT NULL"
        )
    )
    rows = result.fetchall()

    for row_id, cron_expr in rows:
        config = _infer_schedule_config(cron_expr)
        if config is not None:
            import json
            config_json = json.dumps(config)
            conn.execute(
                sa.text(
                    "UPDATE scheduled_tasks SET schedule_config = CAST(:config AS jsonb) "
                    "WHERE id = :id"
                ),
                {"config": config_json, "id": row_id},
            )

    op.create_index(
        "ix_scheduled_tasks_schedule_config",
        "scheduled_tasks",
        ["schedule_config"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    """Remove schedule_config column."""
    op.drop_index("ix_scheduled_tasks_schedule_config", table_name="scheduled_tasks")
    op.drop_column("scheduled_tasks", "schedule_config")
