"""
Modelos de Gestión de Tareas de Ingeniería/NOC (SQLAlchemy 2.0)

Este módulo contiene los modelos para la gestión de tareas de ingeniería,
diagnostics NOC y mantenimiento de infraestructura.

Tablas principales:
  - EngineeringTask: Tareas de ingeniería derivadas de tickets o internas

Flujos soportados:
  1. Reactivo: Tareas derivadas de un Ticket (support-driven)
  2. Proactivo: Tareas internas de mantenimiento/diagnóstico (self-initiated)

NOTA: Este módulo sigue la filosofía "Clean Slate" de Emerald ERP.
Usa SQLAlchemy 2.0 con Mapped[] y mapped_column() exclusivamente.
"""
from __future__ import annotations

from enum import StrEnum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.database.base import Base, TimestampMixin


# ===========================
# ENUMS: Tipos, Prioridades, Estados de Tareas
# ===========================

class EngineeringTaskType(StrEnum):
    """Tipos de tareas de ingeniería."""
    incident = "incident"                # Soporte a incidente crítico
    maintenance = "maintenance"          # Mantenimiento preventivo
    project = "project"                  # Implementación de proyecto


class EngineeringTaskPriority(StrEnum):
    """Prioridades de tareas de ingeniería."""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class EngineeringTaskStatus(StrEnum):
    """Estados de una tarea de ingeniería."""
    backlog = "backlog"                  # Sin asignar / pendiente inicio
    in_progress = "in_progress"          # Trabajo en curso
    testing = "testing"                  # Validación/testing
    completed = "completed"              # Completada exitosamente
    rejected = "rejected"                # Rechazada/No realizable


class EngineeringTaskTimelineEventType(StrEnum):
    """Tipos de eventos del timeline de tareas de ingeniería."""
    NOTE = "NOTE"                  # Nota manual
    STATUS_CHANGE = "STATUS_CHANGE" # Cambio de estado
    ASSIGNMENT = "ASSIGNMENT"       # Cambio de asignación


# ===========================
# MODELO: EngineeringTask
# ===========================

class EngineeringTask(Base, TimestampMixin):
    """
    Modelo de Tareas de Ingeniería/NOC.

    Una tarea de ingeniería representa trabajo que debe ejecutarse para:
      1. Resolver un incidente técnico (REACTIVO: ticket_id NOT NULL)
      2. Realizar mantenimiento o diagnóstico interno (PROACTIVO: ticket_id NULL)

    Transiciones de estado:
      - backlog → in_progress: Asignación a ingeniero
      - in_progress → testing: Validación de corrección
      - testing → completed: Cierre exitoso (actualiza Ticket a "attention_required")
      - testing → rejected: Validación fallida, vuelve a in_progress
      - * → rejected: Cancelación (si ticket_id, Ticket vuelve a "pending")

    Relaciones:
      - ticket: Ticket de soporte padre (optional, solo para flujo reactivo)
      - assigned_to: Ingeniero asignado
      - created_by: Usuario que creó la tarea

    Auditoría:
      - created_at: Timestamp de creación
      - updated_at: Timestamp de última modificación
      - timeline_data: JSONB con eventos de estado (máquina de estados)
    """
    __tablename__ = "engineering_tasks"

    # Primary Key
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único de la tarea"
    )

    # FK a Ticket (OPTIONAL - NULL para tareas proactivas)
    ticket_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tickets.id", name="fk_engineering_tasks_ticket_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="FK a ticket de soporte (NULL para tareas proactivas)"
    )

    # Datos básicos de la tarea
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Título/descripción breve de la tarea"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Descripción detallada de qué hacer"
    )

    # Tipo, prioridad, estado
    task_type: Mapped[EngineeringTaskType] = mapped_column(
        Enum(EngineeringTaskType, name="engineering_task_type_enum", native_enum=False),
        default=EngineeringTaskType.incident,
        nullable=False,
        index=True,
        comment="Tipo: incident, maintenance, project"
    )

    priority: Mapped[EngineeringTaskPriority] = mapped_column(
        Enum(EngineeringTaskPriority, name="engineering_task_priority_enum", native_enum=False),
        default=EngineeringTaskPriority.medium,
        nullable=False,
        index=True,
        comment="Prioridad: critical, high, medium, low"
    )

    status: Mapped[EngineeringTaskStatus] = mapped_column(
        Enum(EngineeringTaskStatus, name="engineering_task_status_enum", native_enum=False),
        default=EngineeringTaskStatus.backlog,
        nullable=False,
        index=True,
        comment="Estado: backlog, in_progress, testing, completed, rejected"
    )

    # Asignación y auditoría
    assigned_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_engineering_tasks_assigned_to_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Ingeniero asignado a la tarea"
    )

    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", name="fk_engineering_tasks_created_by_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Usuario que creó la tarea"
    )

    # Fechas
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha estimada de inicio (para planificación)"
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp de inicio (cuando pasó a in_progress)"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp de completación (cuando pasó a completed o rejected)"
    )

    # Notas de resolución/rechazo
    resolution_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Nota de resolución cuando status=completed"
    )

    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Razón de rechazo cuando status=rejected"
    )

    # Auditoría: timeline de cambios de estado (JSONB)
    timeline_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Histórico de cambios de estado en formato JSON"
    )

    # Relaciones
    ticket: Mapped[Optional["Ticket"]] = relationship(
        "Ticket",
        foreign_keys=[ticket_id],
        lazy="joined",
        back_populates="engineering_tasks",
        cascade=""
    )

    assigned_to: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="joined"
    )

    created_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="joined"
    )

    timeline_events: Mapped[list["EngineeringTaskTimeline"]] = relationship(
        "EngineeringTaskTimeline",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="EngineeringTaskTimeline.created_at"
    )

    # Índices para queries frecuentes
    __table_args__ = (
        Index(
            'idx_engineering_tasks_ticket_status',
            'ticket_id',
            'status'
        ),
        Index(
            'idx_engineering_tasks_assigned_status',
            'assigned_to_id',
            'status'
        ),
        Index(
            'idx_engineering_tasks_type_priority_status',
            'task_type',
            'priority',
            'status'
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<EngineeringTask(id={self.id}, title='{self.title}', "
            f"status={self.status}, assigned_to={self.assigned_to_id})>"
        )


# ===========================
# MODELO: EngineeringTaskTimeline
# ===========================

class EngineeringTaskTimeline(Base):
    """
    Bitácora de eventos para tareas de ingeniería.

    Registra notas manuales, cambios de estado y cambios de asignación.
    """
    __tablename__ = "engineering_task_timeline"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del evento"
    )

    task_id: Mapped[int] = mapped_column(
        ForeignKey("engineering_tasks.id", name="fk_engineering_task_timeline_task_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a tarea de ingeniería"
    )

    author_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_engineering_task_timeline_author_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario que generó el evento"
    )

    event_type: Mapped[EngineeringTaskTimelineEventType] = mapped_column(
        Enum(
            EngineeringTaskTimelineEventType,
            name="engineering_task_timeline_event_type_enum",
            native_enum=False
        ),
        nullable=False,
        index=True,
        comment="Tipo de evento: NOTE, STATUS_CHANGE, ASSIGNMENT"
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Contenido del evento"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Fecha de creación del evento"
    )

    task: Mapped["EngineeringTask"] = relationship(
        "EngineeringTask",
        back_populates="timeline_events",
        lazy="joined"
    )

    author: Mapped[Optional["User"]] = relationship(
        "User",
        lazy="joined"
    )

    __table_args__ = (
        Index("ix_engineering_task_timeline_task_created", "task_id", "created_at"),
        Index("ix_engineering_task_timeline_event_type", "event_type"),
    )

    def __repr__(self) -> str:
        return (
            f"<EngineeringTaskTimeline(id={self.id}, task_id={self.task_id}, "
            f"type={self.event_type})>"
        )


# Importar modelos necesarios para type hints
from src.models.tickets import Ticket
from src.models.user import User
