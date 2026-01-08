"""
Modelos de Tickets y Órdenes de Trabajo (SQLAlchemy 2.0)

Este módulo contiene los modelos para la gestión de incidentes técnicos,
órdenes de trabajo y control de materiales consumidos.

Tablas principales:
  - Ticket: Incidentes técnicos asociados a conexiones
  - TicketTimeline: Bitácora unificada (notas, alertas, eventos OT)
  - WorkOrder: Órdenes de trabajo derivadas de tickets
  - WorkOrderItem: Detalle de materiales consumidos en OT

NOTA: Estos modelos siguen la filosofía "Clean Slate" de Emerald ERP.
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
    Float,
    Index,
    Table,
    Column,
    Boolean,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.database.base import Base, TimestampMixin
from src.models.user import User


# ===========================
# TABLA DE ASOCIACIÓN M2M: TICKET <-> TAG
# ===========================

ticket_tags_association = Table(
    'ticket_tags',
    Base.metadata,
    Column(
        'ticket_id',
        Integer,
            ForeignKey('tickets.id', name='fk_ticket_tags_ticket_id', ondelete='CASCADE'),
        primary_key=True,
        comment='FK a ticket'
    ),
    Column(
        'tag_id',
        Integer,
        ForeignKey('tags.id', name='fk_ticket_tags_tag_id', ondelete='CASCADE'),
        primary_key=True,
        comment='FK a tag'
    ),
    comment='Asociación Many-to-Many entre tickets y etiquetas'
)


# ===========================
# ENUMS - Estados y Tipos
# ===========================

class TicketStatus(StrEnum):
    """Estados posibles de un ticket."""
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    pending_infra = "pending_infra"
    resolved = "resolved"
    closed = "closed"


class TicketPriority(StrEnum):
    """Prioridades de tickets."""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TicketTimelineEventType(StrEnum):
    """Tipos de eventos en la bitácora de ticket."""
    note = "note"  # Nota manual del operador
    alert = "alert"  # Alerta del sistema (Beholder)
    ot_event = "ot_event"  # Cambio de estado en OT
    status_change = "status_change"  # Cambio de estado del ticket
    file = "file"  # Archivo adjunto


class WorkOrderStatus(StrEnum):
    """Estados posibles de una Orden de Trabajo."""
    pending_planning = "pending_planning"  # Aguardando asignación del planificador
    assigned = "assigned"  # Asignada a un técnico
    in_progress = "in_progress"  # Técnico trabajando en sitio
    completed = "completed"  # Trabajo completado
    failed = "failed"  # Fallo en ejecución


class WorkOrderType(StrEnum):
    """Tipos de órdenes de trabajo."""
    repair = "repair"  # Reparación/Diagnóstico
    install = "install"  # Instalación
    pickup = "pickup"  # Retiro de equipo
    infrastructure = "infrastructure"  # Cuadrilla de infraestructura


class TicketType(StrEnum):
    """
    Tipos de tickets según flujo de negocio.
    Define el proceso y las validaciones necesarias.
    """
    technical = "technical"              # Soporte/Reclamo técnico
    installation = "installation"        # Alta de servicio (nueva conexión)
    withdrawal = "withdrawal"            # Baja de servicio (retiro de equipos)
    relocation = "relocation"            # Traslado/Mudanza (origen → destino)
    administrative = "administrative"    # Gestión administrativa


class AdministrativeSubtype(StrEnum):
    """Subtipos para tickets administrativos."""
    billing = "billing"                  # Consultas de facturación
    data_update = "data_update"          # Actualización de datos del cliente
    plan_change = "plan_change"          # Cambio de plan/upgrade
    other = "other"                      # Otros trámites


class WorkOrderResolutionType(StrEnum):
    """Tipos de resolución de una OT (resultado final)."""
    success = "success"  # Completado exitosamente
    failed = "failed"  # No se pudo realizar
    rescheduled = "rescheduled"  # Reprogramado para otra fecha
    partial = "partial"  # Completado parcialmente


class ResolutionCategory(StrEnum):
    """Categoría macro de resolución de una OT completada."""
    infrastructure = "infrastructure"  # Infraestructura (fibra, nodos, torres)
    equipment = "equipment"  # Equipamiento (routers, ONUs, antenas)
    configuration = "configuration"  # Configuración (software, parámetros)
    other = "other"  # Otra categoría


# ===========================
# MODELO: Tag (Etiqueta)
# ===========================

class Tag(Base, TimestampMixin):
    """
    Modelo de Etiquetas para clasificar tickets.
    
    Permite categorizar incidentes de forma flexible:
    - "WiFi", "Fibra Cortada", "Zona Norte"
    - "Reiterado", "Urgente", "Cliente VIP"
    
    Cada etiqueta tiene un color para destacar visualmente.
    """
    __tablename__ = 'tags'

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment='ID único de la etiqueta'
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment='Nombre único de la etiqueta (ej: "Fibra Cortada")'
    )

    color: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default='emerald',
        comment='Color Hex o nombre Tailwind (ej: "#ef4444" o "emerald")'
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment='Etiqueta activa (visible en UI)'
    )

    # Relaciones
    tickets: Mapped[list['Ticket']] = relationship(
        'Ticket',
        secondary=ticket_tags_association,
        back_populates='tags',
        lazy='selectin',
        viewonly=False
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name={self.name}, color={self.color})>"


# ===========================
# MODELOS - Base de Datos
# ===========================

class Ticket(Base, TimestampMixin):
    """
    Modelo de Tickets - Incidentes técnicos (Versión 2.0).

    Un ticket representa un problema reportado por un cliente.
    Puede generar una o más órdenes de trabajo (OT).

    Relaciones:
      - creator: Usuario que creó el ticket
      - assigned_to: Operador responsable
      - timeline: Bitácora de eventos
      - work_orders: Órdenes de trabajo derivadas

    Campos especiales:
      - connection_id: Soft FK a tabla de conexiones (sin constraint estricta)
      - priority: Enum con valores CRITICAL, HIGH, MEDIUM, LOW
            - status: Enum con valores OPEN, IN_PROGRESS, PENDING, PENDING_INFRA, RESOLVED, CLOSED
    """
    __tablename__ = "tickets"

    # Primary Key
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del ticket"
    )

    # Soft FK a conexión (sin constraint para flexibilidad)
    connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a tabla de conexiones (sin constraint para flexibilidad)"
    )

    # Datos del incidente
    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Asunto/Título del ticket"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Descripción detallada del problema"
    )

    # Disponibilidad horaria del cliente
    availability_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Nota sobre disponibilidad horaria del cliente (ej: 'Solo mañanas')"
    )

    # Estado y prioridad
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum", native_enum=False),
        default=TicketStatus.open,
        nullable=False,
        index=True,
        comment="Estado actual del ticket: open, in_progress, pending, pending_infra, resolved, closed"
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum", native_enum=False),
        default=TicketPriority.medium,
        nullable=False,
        index=True,
        comment="Prioridad del incidente: critical, high, medium, low"
    )

    # Auditoría - Relación con users
    creator_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_tickets_creator_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario que creó el ticket"
    )
    assigned_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_tickets_assigned_to_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Operador asignado al ticket"
    )

    # Tipo de ticket y flujo de negocio (NUEVO)
    ticket_type: Mapped[TicketType] = mapped_column(
        Enum(TicketType, name="ticket_type_enum", native_enum=False),
        default=TicketType.technical,
        nullable=False,
        index=True,
        comment="Tipo de flujo: technical, installation, withdrawal, relocation, administrative"
    )

    # Subtipo administrativo (NUEVO - opcional, solo para ADMINISTRATIVE)
    administrative_subtype: Mapped[Optional[AdministrativeSubtype]] = mapped_column(
        Enum(AdministrativeSubtype, name="administrative_subtype_enum", native_enum=False),
        nullable=True,
        comment="Subtipo para tickets administrativos: billing, data_update, plan_change, other"
    )

    # Campos para traslados (NUEVO)
    origin_connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a conexión de origen (para RELOCATION)"
    )

    destination_connection_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="FK soft a conexión de destino (para RELOCATION, INSTALLATION)"
    )

    # Tecnología de instalación (NUEVO - para INSTALLATION)
    installation_tech: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Tecnología de instalación: fiber, wireless, hybrid (para INSTALLATION)"
    )

    # Relaciones
    creator: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[creator_id],
        lazy="joined"
    )
    assigned_to: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        lazy="joined"
    )
    timeline: Mapped[list[TicketTimeline]] = relationship(
        "TicketTimeline",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TicketTimeline.created_at.asc()"
    )
    work_orders: Mapped[list[WorkOrder]] = relationship(
        "WorkOrder",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan"
    )
    attachments: Mapped[list[TicketAttachment]] = relationship(
        "TicketAttachment",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan"
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary=ticket_tags_association,
        back_populates="tickets",
        lazy="selectin",
        viewonly=False
    )

    # Índices compuestos
    __table_args__ = (
        Index("ix_tickets_status_priority", "status", "priority"),
        Index("ix_tickets_creator", "creator_id"),
        Index("ix_tickets_assigned", "assigned_to_id"),
        Index("ix_tickets_ticket_type", "ticket_type"),
        Index("ix_tickets_origin_connection", "origin_connection_id"),
        Index("ix_tickets_destination_connection", "destination_connection_id"),
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, subject='{self.subject}', status={self.status})>"


class TicketTimeline(Base, TimestampMixin):
    """
    Modelo de Bitácora de Ticket - Timeline unificado.

    Almacena todos los eventos relacionados con un ticket:
    - Notas manuales del operador
    - Alertas del sistema (Beholder)
    - Cambios de estado de órdenes de trabajo
    - Cambios de estado del ticket

    Objetivo: Crear un registro auditable único de todo lo que pasó
    con el ticket sin necesidad de buscar en múltiples tablas.

    El campo 'metadata' (JSONB) puede contener snapshots técnicos:
      {
        "onu_status": "offline",
        "signal_dbm": -32.5,
        "node": "NOD-NORTE-04",
        "ip": "192.168.100.45",
        "previous_status": "open",
        "new_status": "pending"
      }
    """
    __tablename__ = "ticket_timeline"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del evento"
    )

    # Foreign Keys
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", name="fk_ticket_timeline_ticket_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a ticket"
    )
    author_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_ticket_timeline_author_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario que generó el evento (nullable para eventos del sistema)"
    )

    # Tipo de evento
    event_type: Mapped[TicketTimelineEventType] = mapped_column(
        Enum(
            TicketTimelineEventType,
            name="ticket_timeline_event_type_enum",
            native_enum=False
        ),
        nullable=False,
        index=True,
        comment="Tipo de evento: note, alert, ot_event, status_change"
    )

    # Contenido
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Texto del evento (nota, descripción alerta, etc)"
    )

    # Metadata JSONB para snapshots técnicos
    meta_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        comment="JSON con snapshot técnico: señal ONU, infraestructura, cambios de estado, etc"
    )

    # Relationships
    ticket: Mapped[Ticket] = relationship(
        "Ticket",
        back_populates="timeline",
        lazy="joined"
    )
    author: Mapped[Optional[User]] = relationship(
        "User",
        lazy="joined"
    )

    # Índices compuestos para queries frecuentes
    __table_args__ = (
        Index("ix_ticket_timeline_ticket_created", "ticket_id", "created_at"),
        Index("ix_ticket_timeline_event_type", "event_type"),
    )

    def __repr__(self) -> str:
        return f"<TicketTimeline(id={self.id}, type={self.event_type}, ticket_id={self.ticket_id})>"


class WorkOrder(Base, TimestampMixin):
    """
    Modelo de Orden de Trabajo (OT) - Tareas técnicas.

    Una OT es una tarea concreta derivada de un ticket.
    Un ticket puede generar múltiples OT (ej: diagnóstico + reparación).

    Estados:
      PENDING_PLANNING → ASSIGNED → IN_PROGRESS → COMPLETED (o FAILED)

    Flujo típico:
      1. Operador crea OT desde ticket (estado: PENDING_PLANNING)
      2. Planificador asigna técnico y programa fecha (estado: ASSIGNED)
      3. Técnico va a sitio y cambia a IN_PROGRESS
      4. Técnico completa trabajo, consume materiales (estado: COMPLETED)
      5. Sistema descuenta stock automáticamente

    Relaciones:
      - ticket: Ticket origen
      - technician: Usuario (técnico asignado)
      - work_order_items: Materiales consumidos

    Campos especiales:
      - scheduled_at: Fecha/hora programada para la visita
      - completed_at: Fecha/hora de finalización real
      - notes: Notas técnicas del trabajo realizado
    """
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único de la OT"
    )

    # Foreign Keys
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", name="fk_work_orders_ticket_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a ticket origen"
    )
    technician_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_work_orders_technician_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Técnico asignado (nullable hasta que planificador asigne)"
    )

    # Tipo y estado
    ot_type: Mapped[WorkOrderType] = mapped_column(
        Enum(WorkOrderType, name="work_order_type_enum", native_enum=False),
        default=WorkOrderType.repair,
        nullable=False,
        comment="Tipo de trabajo: repair, install, pickup"
    )
    status: Mapped[WorkOrderStatus] = mapped_column(
        Enum(WorkOrderStatus, name="work_order_status_enum", native_enum=False),
        default=WorkOrderStatus.pending_planning,
        nullable=False,
        index=True,
        comment="Estado actual: pending_planning, assigned, in_progress, completed, failed"
    )

    # Planificación y ejecución
    scheduled_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Fecha/hora programada para la visita"
    )
    started_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha/hora en que el técnico inició el trabajo en sitio"
    )
    completed_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha/hora de finalización real del trabajo"
    )

    # Resolución
    resolution_type: Mapped[Optional[WorkOrderResolutionType]] = mapped_column(
        Enum(WorkOrderResolutionType, name="work_order_resolution_type_enum", native_enum=False),
        nullable=True,
        comment="Tipo de resolución: success, failed, rescheduled, partial"
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas del técnico sobre la resolución final"
    )

    resolution_category: Mapped[Optional[ResolutionCategory]] = mapped_column(
        Enum(ResolutionCategory, name="resolution_category_enum", native_enum=False),
        nullable=True,
        comment="Categoría macro de resolución: infrastructure, equipment, configuration, other"
    )

    photo_urls: Mapped[Optional[list[str]]] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        comment="Array de URLs de fotos de evidencia de la resolución"
    )

    # Datos flexibles del diagnóstico (JSONB)
    custom_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="""Datos flexibles del técnico (JSONB): 
        - optical_signal_dbm: float (nivel de luz)
        - speedtest_download_mbps: float
        - speedtest_upload_mbps: float
        - mac_address_recovered: str (para bajas)
        - onu_serial_installed: str (para instalaciones)
        - beholder_check_result: dict (diagnóstico rápido)
        - photos: list[str] (URLs de fotos)
        """
    )

    # Notas técnicas (deprecated, usar resolution_notes)
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas del técnico sobre el trabajo realizado (deprecated, usar resolution_notes)"
    )

    # Relationships
    ticket: Mapped[Ticket] = relationship(
        "Ticket",
        back_populates="work_orders",
        lazy="joined"
    )
    technician: Mapped[Optional[User]] = relationship(
        "User",
        lazy="joined"
    )
    work_order_items: Mapped[list[WorkOrderItem]] = relationship(
        "WorkOrderItem",
        back_populates="work_order",
        lazy="select",
        cascade="all, delete-orphan"
    )

    # Índices compuestos
    __table_args__ = (
        Index("ix_work_orders_ticket_status", "ticket_id", "status"),
        Index("ix_work_orders_technician", "technician_id"),
        Index("ix_work_orders_scheduled", "scheduled_at"),
    )

    def __repr__(self) -> str:
        return f"<WorkOrder(id={self.id}, type={self.ot_type}, status={self.status})>"


class WorkOrderItem(Base, TimestampMixin):
    """
    Modelo de Item de Orden de Trabajo - Detalle de materiales.

    Registra los materiales consumidos en una OT específica.
    Permite:
      - Rastrear qué se usó en cada intervención
      - Descontar automáticamente del inventario
      - Trazabilidad de equipos (serial numbers)

    Ejemplo de fila:
      work_order_id=5, product_id=12, quantity=40.5,
      serial_number="ONT-SN-2025-00423"

    El campo 'product_id' es un Integer sin FK estricta para permitir
    flexibilidad si la tabla de productos está en otro esquema o módulo.

    El campo 'serial_number' es útil para equipos críticos como:
      - ONUs (ONT-SN-xxx)
      - Routers CPE (CPE-SN-xxx)
      - Módulos (MOD-SN-xxx)

    Relaciones:
      - work_order: OT a la que pertenece este item
    """
    __tablename__ = "work_order_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del item"
    )

    # Foreign Key
    work_order_id: Mapped[int] = mapped_column(
        ForeignKey("work_orders.id", name="fk_work_order_items_work_order_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a work_order"
    )

    # Producto (soft FK: sin constraint estricta para flexibilidad de esquemas)
    product_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="ID del producto en inventario (soft FK, sin constraint)"
    )

    # Cantidad consumida
    quantity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Cantidad utilizada (ej: 40.5 metros de fibra, 1.0 unidad de ONU)"
    )

    # Trazabilidad de equipos
    serial_number: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Número de serie (para ONUs, Routers, módulos, etc). Formato: TYPE-SN-XXXX"
    )

    # Notas adicionales
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Observaciones sobre este material"
    )

    # Relationships
    work_order: Mapped[WorkOrder] = relationship(
        "WorkOrder",
        back_populates="work_order_items",
        lazy="joined"
    )

    # Índices compuestos
    __table_args__ = (
        Index("ix_work_order_items_product", "product_id"),
        Index("ix_work_order_items_serial", "serial_number"),
    )

    def __repr__(self) -> str:
        return f"<WorkOrderItem(id={self.id}, wo_id={self.work_order_id}, qty={self.quantity})>"
