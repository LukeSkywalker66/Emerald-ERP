"""add_system_config_and_service_monitors

Revision ID: 7779579452c7
Revises: 2026_05_21_001
Create Date: 2026-05-22 12:36:32.152631

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "7779579452c7"
down_revision: Union[str, Sequence[str], None] = "2026_05_21_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create system_config and service_monitors tables."""

    # === system_config ===
    op.create_table("system_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False,
                  comment="Identificador unico de la configuracion"),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True,
                  comment="Valor en JSON flexible"),
        sa.Column("description", sa.String(length=255), nullable=True,
                  comment="Descripcion de la configuracion"),
        sa.Column("updated_by", sa.Integer(), nullable=True,
                  comment="ID del usuario que actualizo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"],
                                name=op.f("fk_system_config_updated_by_users"),
                                ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_system_config"))
    )
    op.create_index(op.f("ix_system_config_id"), "system_config", ["id"], unique=False)
    op.create_index(op.f("ix_system_config_key"), "system_config", ["key"], unique=True)
    op.create_index(op.f("ix_system_config_updated_by"), "system_config", ["updated_by"], unique=False)

    # === service_monitors ===
    op.create_table("service_monitors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=False,
                  comment="Etiqueta del monitor"),
        sa.Column("url", sa.String(length=500), nullable=False,
                  comment="URL del endpoint"),
        sa.Column("monitor_type", sa.Enum("HTTP", "PING", "TCP", "SSL", name="monitortype"),
                  nullable=False, comment="Tipo de verificacion"),
        sa.Column("auth_username", sa.String(length=100), nullable=True,
                  comment="Usuario de autenticacion"),
        sa.Column("auth_password_hash", sa.String(length=255), nullable=True,
                  comment="Contrasena hasheada"),
        sa.Column("criticality_index", sa.Integer(), nullable=False,
                  comment="Indice de criticidad 1-5"),
        sa.Column("alert_color", sa.String(length=7), nullable=False,
                  comment="Color hexadecimal de alerta"),
        sa.Column("check_interval_seconds", sa.Integer(), nullable=False,
                  comment="Intervalo entre verificaciones (segundos)"),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  comment="Activo para monitoreo"),
        sa.Column("last_status", sa.Enum("UP", "DOWN", "UNKNOWN", "DEGRADED", name="monitorstatus"),
                  nullable=False, comment="Ultimo estado"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True,
                  comment="Ultima verificacion"),
        sa.Column("last_status_code", sa.Integer(), nullable=True,
                  comment="Ultimo codigo HTTP"),
        sa.Column("last_error_message", sa.Text(), nullable=True,
                  comment="Mensaje de error"),
        sa.Column("response_time_ms", sa.Float(), nullable=True,
                  comment="Tiempo de respuesta ms"),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True,
                  comment="Etiquetas JSON"),
        sa.Column("notes", sa.Text(), nullable=True,
                  comment="Notas internas"),
        sa.Column("created_by", sa.Integer(), nullable=True,
                  comment="ID del creador"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"],
                                name=op.f("fk_service_monitors_created_by_users"),
                                ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service_monitors"))
    )
    op.create_index(op.f("ix_service_monitors_id"), "service_monitors", ["id"], unique=False)
    op.create_index(op.f("ix_service_monitors_is_active"), "service_monitors", ["is_active"], unique=False)


def downgrade() -> None:
    """Downgrade schema - Drop system_config and service_monitors tables."""

    op.drop_index(op.f("ix_service_monitors_is_active"), table_name="service_monitors")
    op.drop_index(op.f("ix_service_monitors_id"), table_name="service_monitors")
    op.drop_table("service_monitors")

    op.drop_index(op.f("ix_system_config_updated_by"), table_name="system_config")
    op.drop_index(op.f("ix_system_config_key"), table_name="system_config")
    op.drop_index(op.f("ix_system_config_id"), table_name="system_config")
    op.drop_table("system_config")

    op.execute("DROP TYPE IF EXISTS monitortype")
    op.execute("DROP TYPE IF EXISTS monitorstatus")
