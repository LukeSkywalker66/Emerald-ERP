"""
Esquemas Pydantic para Tareas de Ingeniería/NOC

Validación y serialización de datos para API REST de Engineering/NOC.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ===========================
# ESQUEMAS BASE
# ===========================

class UserBasicResponse(BaseModel):
    """Datos mínimos de usuario para respuestas nested."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None


class TicketBasicResponse(BaseModel):
    """Datos mínimos de ticket para respuestas nested."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    status: str
    priority: str
    client_name: Optional[str] = None


# ===========================
# ESQUEMAS DE TAREA DE INGENIERÍA
# ===========================

class EngineeringTaskBase(BaseModel):
    """Campos base comunes a todas las operaciones."""
    title: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Título de la tarea (5-255 caracteres)"
    )
    description: Optional[str] = Field(
        None,
        max_length=5000,
        description="Descripción detallada (max 5000 caracteres)"
    )
    task_type: str = Field(
        ...,
        description="Tipo: incident, maintenance, project"
    )
    priority: str = Field(
        default="medium",
        description="Prioridad: critical, high, medium, low"
    )
    scheduled_date: Optional[datetime] = Field(
        None,
        description="Fecha estimada de inicio (ISO 8601)"
    )


class EngineeringTaskCreate(EngineeringTaskBase):
    """Esquema para crear una nueva tarea."""
    model_config = ConfigDict(from_attributes=True)

    ticket_id: Optional[int] = Field(
        None,
        description="ID del ticket de soporte (si es reactivo)"
    )
    assigned_to_id: Optional[int] = Field(
        None,
        description="ID del ingeniero asignado"
    )


class EngineeringTaskUpdate(BaseModel):
    """Esquema para actualizar una tarea (todos campos opcionales)."""
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    task_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = Field(None, description="Nueva transición de estado")
    assigned_to_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    resolution_note: Optional[str] = Field(None, max_length=5000)
    rejection_reason: Optional[str] = Field(None, max_length=5000)


class EngineeringTaskRead(BaseModel):
    """Esquema de lectura completo con todas las relaciones."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    task_type: str
    priority: str
    status: str
    assigned_to_id: Optional[int] = None
    created_by_id: int
    scheduled_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Relaciones nested
    ticket: Optional[TicketBasicResponse] = None
    assigned_to: Optional[UserBasicResponse] = None
    created_by: UserBasicResponse


class EngineeringTaskListResponse(BaseModel):
    """Esquema compacto para listar tareas."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: Optional[int] = None
    title: str
    task_type: str
    priority: str
    status: str
    assigned_to_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Relaciones mínimas
    assigned_to: Optional[UserBasicResponse] = None


class EngineeringTaskDetailResponse(EngineeringTaskRead):
    """Extensión de Read con contexto adicional para detalle."""
    timeline_data: Optional[dict] = None


# ===========================
# ESQUEMAS DE TIMELINE DE TAREA
# ===========================

class EngineeringTaskTimelineNoteCreate(BaseModel):
    """Payload para agregar una nota manual al timeline de tarea."""
    content: str = Field(..., min_length=1, max_length=5000)


class EngineeringTaskTimelineEventResponse(BaseModel):
    """Respuesta de evento de timeline de tarea."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    author_id: Optional[int] = None
    event_type: str
    content: str
    created_at: datetime
    author: Optional[UserBasicResponse] = None


class EngineeringTaskStatsResponse(BaseModel):
    """Estadísticas para el dashboard de ingeniería."""
    total_tasks: int = Field(..., description="Total de tareas")
    by_status: dict = Field(..., description="Conteo por estado")
    by_priority: dict = Field(..., description="Conteo por prioridad")
    by_type: dict = Field(..., description="Conteo por tipo")
    assigned_to_me: int = Field(..., description="Tareas asignadas al usuario actual")
    critical_count: int = Field(..., description="Tareas críticas sin completar")
