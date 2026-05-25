"""
Schemas Pydantic para Scheduled Tasks V2.

Define los contratos de datos para:
- Respuesta de una tarea programada
- Actualización de configuración (cron, activo, max_executions)
- Trigger de ejecución forzada
- Log de ejecuciones (sync_status)
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ScheduledTaskResponse(BaseModel):
    """Respuesta completa de una tarea programada."""
    id: int
    task_name: str
    celery_task_path: str
    display_name: str
    description: Optional[str] = None
    category: str = "general"
    schedule_config: Optional[dict] = Field(
        None,
        description="Configuración estructurada del schedule. Ej: "
                    "{'type':'daily','times':['03:00']}"
    )
    cron_expression: Optional[str] = None
    is_active: bool = True
    max_executions: Optional[int] = None
    execution_count: int = 0
    last_execution_at: Optional[datetime] = None
    last_execution_status: Optional[str] = None
    is_system_task: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScheduledTaskUpdate(BaseModel):
    """Schema para actualizar la configuración de una tarea programada."""
    schedule_config: Optional[dict] = Field(
        None,
        description="Configuración estructurada del schedule. "
                    "Si se envía, cron_expression se computa automáticamente."
    )
    cron_expression: Optional[str] = Field(
        None, min_length=1, max_length=100,
        description="Expresión cron (ej: '0 3 * * *'). "
                    "Si se envía junto con schedule_config, prevalece schedule_config."
    )
    is_active: Optional[bool] = Field(
        None,
        description="Activar o desactivar la tarea. Enviar null para no cambiar."
    )
    max_executions: Optional[Optional[int]] = Field(
        None,
        description="Máximo de ejecuciones (0 = desactivar, null = ilimitado, -1 = no cambiar)"
    )


class ScheduledTaskTriggerResponse(BaseModel):
    """Respuesta después de forzar la ejecución de una tarea."""
    success: bool
    task_name: str
    display_name: str
    message: str
    task_id: Optional[str] = Field(
        None,
        description="ID de la tarea Celery enviada (si aplica)"
    )


class ScheduledTaskLogEntry(BaseModel):
    """Una entrada del log de ejecución de una tarea."""
    id: int
    fuente: str
    ultima_actualizacion: Optional[datetime] = None
    estado: Optional[str] = None
    detalle: Optional[str] = None

    model_config = {"from_attributes": True}


class ScheduledTaskLogResponse(BaseModel):
    """Respuesta paginada del log de ejecuciones."""
    items: list[ScheduledTaskLogEntry]
    total: int
    limit: int
    offset: int


class ScheduledTaskSyncResponse(BaseModel):
    """Respuesta después de sincronizar desde Celery Beat."""
    success: bool
    tasks_synced: int
    message: str
