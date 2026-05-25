"""
Modelo para gestión persistente de tareas programadas (Scheduled Tasks V2).

Permite:
- Almacenar configuración de cada tarea Celery en DB
- Ajustar schedule (cron) desde la UI sin editar código
- Activar/desactivar tareas individualmente
- Controlar número máximo de ejecuciones
- Consultar historial de ejecuciones

Relación con Celery Beat:
- Cada fila representa una tarea que Celery Beat puede ejecutar
- El beat_schedule se construye dinámicamente desde esta tabla al iniciar
- Las tareas de sistema (is_system_task=True) se ocultan de la UI principal
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from src.database.base import Base, TimestampMixin


class ScheduledTask(Base, TimestampMixin):
    """
    Configuración persistente de una tarea programada de Celery.

    Cada registro representa una tarea conocida por el sistema, con su
    schedule, estado activo/inactivo y estadísticas de ejecución.
    """
    __tablename__ = "scheduled_tasks"

    id: int = Column(Integer, primary_key=True, autoincrement=True)

    # --- Identificación ---
    task_name: str = Column(
        String(255), unique=True, nullable=False,
        comment="Nombre corto único de la tarea (ej: nightly_sync_task)"
    )
    celery_task_path: str = Column(
        String(255), nullable=False,
        comment="Ruta completa de la tarea Celery (ej: src.jobs.sync.nightly_sync_task)"
    )

    # --- Display ---
    display_name: str = Column(
        String(255), nullable=False,
        comment="Nombre legible para mostrar en la UI"
    )
    description: Optional[str] = Column(
        Text, nullable=True,
        comment="Descripción detallada de la tarea"
    )
    category: str = Column(
        String(50), nullable=False, default="general",
        comment="Categoría: sync, maintenance, api_keys, general"
    )

    # --- Configuración de schedule ---
    schedule_config: Optional[dict] = Column(
        JSONB, nullable=True,
        comment="Configuración estructurada del schedule: tipo, intervalo, horarios, días"
    )
    cron_expression: Optional[str] = Column(
        String(100), nullable=True,
        comment="Expresión cron en formato estándar: 'minuto hora día_mes mes día_semana'. "
                "Se computa automáticamente desde schedule_config."
    )
    is_active: bool = Column(
        Boolean, default=True,
        comment="Si está activa para ejecución programada por Celery Beat"
    )

    # --- Control de ejecuciones ---
    max_executions: Optional[int] = Column(
        Integer, nullable=True,
        comment="Máximo de ejecuciones permitidas (null = ilimitado)"
    )
    execution_count: int = Column(
        Integer, default=0,
        comment="Contador total de ejecuciones realizadas"
    )
    last_execution_at: Optional[datetime] = Column(
        DateTime(timezone=True), nullable=True,
        comment="Timestamp de la última ejecución"
    )
    last_execution_status: Optional[str] = Column(
        String(50), nullable=True,
        comment="Estado de la última ejecución: success, failed, running"
    )

    # --- Metadatos ---
    is_system_task: bool = Column(
        Boolean, default=False,
        comment="Si es True, se oculta de la UI principal (ej: tareas internas de API keys)"
    )

    def __repr__(self) -> str:
        return (
            f"<ScheduledTask id={self.id} "
            f"name='{self.task_name}' "
            f"active={self.is_active} "
            f"cron='{self.cron_expression}'>"
        )
