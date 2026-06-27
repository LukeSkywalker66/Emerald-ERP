"""add include_minio_backup to backup_config

Revision ID: 2026_06_25_002_backup_minio
Revises: 2026_06_25_001_backup_tables
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2026_06_25_002_backup_minio"
down_revision = "2026_06_25_001_backup_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna include_minio_backup a backup_config
    op.add_column(
        "backup_config",
        sa.Column(
            "include_minio_backup",
            sa.Boolean(),
            nullable=False,
            server_default="true",
            comment="Incluir bucket MinIO en el respaldo (adjuntos, capturas, reportes)",
        ),
    )
    # Agregar columna minio_bucket a backup_config
    op.add_column(
        "backup_config",
        sa.Column(
            "minio_bucket",
            sa.String(100),
            nullable=False,
            server_default="emerald-attachments",
            comment="Nombre del bucket MinIO a respaldar",
        ),
    )


def downgrade() -> None:
    op.drop_column("backup_config", "minio_bucket")
    op.drop_column("backup_config", "include_minio_backup")
