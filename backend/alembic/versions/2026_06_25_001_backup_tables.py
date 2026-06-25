"""add backup config and backup runs tables

Revision ID: 2026_06_25_001_backup_tables
Revises: 2026_06_17_002
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2026_06_25_001_backup_tables"
down_revision = "2026_06_17_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- backup_config (singleton) ---
    op.create_table(
        "backup_config",
        sa.Column("id", sa.Integer(), primary_key=True, default=1),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("cron_expression", sa.String(50), nullable=False, server_default="0 2 * * *"),
        sa.Column("drive_remote_name", sa.String(100), nullable=False, server_default="gdrive"),
        sa.Column("drive_folder_id", sa.String(200), nullable=False, server_default="Emerald_ERP_BackUps"),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("backup_dir", sa.String(255), nullable=False, server_default="/tmp/emerald_backups"),
        sa.Column("lan_backup_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("lan_server_ip", sa.String(45), nullable=True),
        sa.Column("lan_server_user", sa.String(100), nullable=True),
        sa.Column("lan_dest_folder", sa.String(255), nullable=True),
        sa.Column("lan_ssh_key_path", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Seed: fila singleton con defaults seguros (is_enabled=False)
    op.execute(
        "INSERT INTO backup_config (id, is_enabled, cron_expression, "
        "drive_remote_name, drive_folder_id, retention_days, backup_dir, "
        "lan_backup_enabled) VALUES (1, false, '0 2 * * *', 'gdrive', "
        "'Emerald_ERP_BackUps', 7, '/tmp/emerald_backups', false) "
        "ON CONFLICT (id) DO NOTHING"
    )

    # --- backup_runs (historial) ---
    op.create_table(
        "backup_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "success", "failed", name="backupstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("log_output", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "triggered_by",
            sa.Enum("scheduled", "manual", name="backuptrigger"),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_backup_runs_started_at", "backup_runs", ["started_at"])
    op.create_index("ix_backup_runs_status", "backup_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_backup_runs_status", table_name="backup_runs")
    op.drop_index("ix_backup_runs_started_at", table_name="backup_runs")
    op.drop_table("backup_runs")
    op.drop_table("backup_config")
    op.execute("DROP TYPE IF EXISTS backupstatus")
    op.execute("DROP TYPE IF EXISTS backuptrigger")
