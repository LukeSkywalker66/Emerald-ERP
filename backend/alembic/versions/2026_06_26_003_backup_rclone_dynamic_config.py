"""add dynamic rclone settings to backup_config

Revision ID: 2026_06_26_003_rclone_cfg
Revises: 2929b12e9cca
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2026_06_26_003_rclone_cfg"
down_revision = "2929b12e9cca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("backup_config")}

    if "minio_remote_name" not in columns:
        op.add_column(
            "backup_config",
            sa.Column(
                "minio_remote_name",
                sa.String(length=100),
                nullable=False,
                server_default="minio",
                comment="Nombre del remoto rclone para acceder a MinIO",
            ),
        )
    if "rclone_config_path" not in columns:
        op.add_column(
            "backup_config",
            sa.Column(
                "rclone_config_path",
                sa.String(length=255),
                nullable=False,
                server_default="/root/.config/rclone/rclone.conf",
                comment="Ruta del archivo rclone.conf dentro del contenedor",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("backup_config")}

    if "rclone_config_path" in columns:
        op.drop_column("backup_config", "rclone_config_path")
    if "minio_remote_name" in columns:
        op.drop_column("backup_config", "minio_remote_name")
