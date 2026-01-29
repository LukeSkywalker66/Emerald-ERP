"""add engineering task timeline

Revision ID: m1n2o3p4q5r6
Revises: k0l1m2n3o4p5q
Create Date: 2026-01-29
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "m1n2o3p4q5r6"
down_revision = "k0l1m2n3o4p5q"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "engineering_task_timeline",
        sa.Column("id", sa.Integer(), nullable=False, comment="ID único del evento"),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("engineering_tasks.id", name="fk_engineering_task_timeline_task_id", ondelete="CASCADE"),
            nullable=False,
            comment="FK a tarea de ingeniería",
        ),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("users.id", name="fk_engineering_task_timeline_author_id", ondelete="SET NULL"),
            nullable=True,
            comment="Usuario que generó el evento",
        ),
        sa.Column(
            "event_type",
            sa.Enum(
                "NOTE",
                "STATUS_CHANGE",
                "ASSIGNMENT",
                name="engineering_task_timeline_event_type_enum",
                native_enum=False,
            ),
            nullable=False,
            comment="Tipo de evento: NOTE, STATUS_CHANGE, ASSIGNMENT",
        ),
        sa.Column("content", sa.Text(), nullable=False, comment="Contenido del evento"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Fecha de creación del evento",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_engineering_task_timeline"),
    )

    op.create_index(
        "ix_engineering_task_timeline_task_created",
        "engineering_task_timeline",
        ["task_id", "created_at"],
    )
    op.create_index(
        "ix_engineering_task_timeline_event_type",
        "engineering_task_timeline",
        ["event_type"],
    )
    op.create_index(
        "ix_engineering_task_timeline_task_id",
        "engineering_task_timeline",
        ["task_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_engineering_task_timeline_task_id", table_name="engineering_task_timeline")
    op.drop_index("ix_engineering_task_timeline_event_type", table_name="engineering_task_timeline")
    op.drop_index("ix_engineering_task_timeline_task_created", table_name="engineering_task_timeline")
    op.drop_table("engineering_task_timeline")
