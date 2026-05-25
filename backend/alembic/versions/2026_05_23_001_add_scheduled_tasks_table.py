"""add_scheduled_tasks_table

Revision ID: 2026_05_23_001
Revises: 7779579452c7
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2026_05_23_001"
down_revision: Union[str, Sequence[str], None] = "7779579452c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create scheduled_tasks table and seed data."""

    # === scheduled_tasks ===
    op.create_table("scheduled_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False,
                  comment="Nombre corto unico de la tarea"),
        sa.Column("celery_task_path", sa.String(length=255), nullable=False,
                  comment="Ruta completa de la tarea Celery"),
        sa.Column("display_name", sa.String(length=255), nullable=False,
                  comment="Nombre legible para mostrar en la UI"),
        sa.Column("description", sa.Text(), nullable=True,
                  comment="Descripcion detallada de la tarea"),
        sa.Column("category", sa.String(length=50), nullable=False,
                  server_default="general",
                  comment="Categoria: sync, maintenance, api_keys, general"),
        sa.Column("cron_expression", sa.String(length=100), nullable=True,
                  comment="Expresion cron estandar: minuto hora dia_mes mes dia_semana"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true",
                  comment="Activa para ejecucion programada por Celery Beat"),
        sa.Column("max_executions", sa.Integer(), nullable=True,
                  comment="Maximo de ejecuciones permitidas (null = ilimitado)"),
        sa.Column("execution_count", sa.Integer(), nullable=False, server_default="0",
                  comment="Contador total de ejecuciones realizadas"),
        sa.Column("last_execution_at", sa.DateTime(timezone=True), nullable=True,
                  comment="Timestamp de la ultima ejecucion"),
        sa.Column("last_execution_status", sa.String(length=50), nullable=True,
                  comment="Estado ultima ejecucion: success, failed, running"),
        sa.Column("is_system_task", sa.Boolean(), nullable=False, server_default="false",
                  comment="Si es True, se oculta de la UI principal"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scheduled_tasks"))
    )
    op.create_index(op.f("ix_scheduled_tasks_id"), "scheduled_tasks", ["id"], unique=False)
    op.create_index(op.f("ix_scheduled_tasks_task_name"), "scheduled_tasks", ["task_name"], unique=True)
    op.create_index(op.f("ix_scheduled_tasks_category"), "scheduled_tasks", ["category"], unique=False)
    op.create_index(op.f("ix_scheduled_tasks_is_active"), "scheduled_tasks", ["is_active"], unique=False)

    # === Seed data: 6 tareas conocidas ===
    op.execute("""
        INSERT INTO scheduled_tasks
            (task_name, celery_task_path, display_name, description, category,
             cron_expression, is_active, execution_count, is_system_task)
        VALUES
        -- 1. Sincronización Nocturna (sync, visible, activa)
        (
            'src.jobs.sync.nightly_sync_task',
            'src.jobs.sync.nightly_sync_task',
            'Sincronización Nocturna',
            'Sincronización automática con ISPCube: nodos, secretos, ONUs, planes, conexiones y clientes. Se ejecuta diariamente a las 3:00 AM.',
            'sync',
            '0 3 * * *',
            true, 0, false
        ),
        -- 2. Limpieza de OTs Abandonadas (maintenance, visible, activa)
        (
            'cleanup_abandoned_work_orders',
            'cleanup_abandoned_work_orders',
            'Limpieza de OTs Abandonadas',
            'Revisa órdenes de trabajo en estado "programada" que hayan superado su hora de inicio + 30 min de gracia. Las pasa a "pendiente de cierre" manteniendo la cuadrilla asignada para trazabilidad.',
            'maintenance',
            '*/30 * * * *',
            true, 0, false
        ),
        -- 3. Limpieza API Keys Expiradas (api_keys, sistema, inactiva)
        (
            'api_keys.cleanup_expired',
            'api_keys.cleanup_expired',
            'Limpieza API Keys Expiradas',
            'Elimina o desactiva automáticamente las API keys que han superado su fecha de expiración.',
            'api_keys',
            '0 2 * * *',
            false, 0, true
        ),
        -- 4. Rotación API Keys Próximas a Vencer (api_keys, sistema, inactiva)
        (
            'api_keys.rotate_expiring',
            'api_keys.rotate_expiring',
            'Rotación API Keys Próximas a Vencer',
            'Rota automáticamente las API keys que expirarán en los próximos 7 días, generando nuevas claves y desactivando las anteriores.',
            'api_keys',
            '0 2 * * 0',
            false, 0, true
        ),
        -- 5. Alerta API Keys por Expirar (api_keys, sistema, inactiva)
        (
            'api_keys.alert_expiring',
            'api_keys.alert_expiring',
            'Alerta API Keys por Expirar',
            'Envía alertas (notificaciones/log) sobre API keys que expirarán en los próximos 30 días.',
            'api_keys',
            '0 8 * * *',
            false, 0, true
        ),
        -- 6. Reporte Auditoría API Keys (api_keys, sistema, inactiva)
        (
            'api_keys.generate_audit_report',
            'api_keys.generate_audit_report',
            'Reporte Auditoría API Keys',
            'Genera un reporte de auditoría con el estado y rotación de todas las API keys del sistema.',
            'api_keys',
            '0 9 1 * *',
            false, 0, true
        );
    """)


def downgrade() -> None:
    """Downgrade schema - Drop scheduled_tasks table."""

    op.drop_index(op.f("ix_scheduled_tasks_is_active"), table_name="scheduled_tasks")
    op.drop_index(op.f("ix_scheduled_tasks_category"), table_name="scheduled_tasks")
    op.drop_index(op.f("ix_scheduled_tasks_task_name"), table_name="scheduled_tasks")
    op.drop_index(op.f("ix_scheduled_tasks_id"), table_name="scheduled_tasks")
    op.drop_table("scheduled_tasks")
