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
    Numeric,
    Index,
    Table,
    Column,
    Boolean,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign
from sqlalchemy.sql import func

from src.database.base import Base, TimestampMixin
from src.models.user import User
from src.models.beholder import Connection as BeholderConnection


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
    waiting_internal = "waiting_internal"  # Esperando acción de ingeniería
    attention_required = "attention_required"  # Ingeniería completó, requiere atención
    resolved = "resolved"
    closed = "closed"
    cancelled = "cancelled"  # Cancelado sin ejecución de OTs


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
    coordinated = "coordinated"            # Fecha pactada con cliente, SIN cuadrilla asignada
    scheduled = "scheduled"                # Fecha pactada Y cuadrilla asignada
    assigned = "assigned"  # Asignada a un técnico individual
    in_progress = "in_progress"  # Técnico trabajando en sitio
    
    # ========== PRISIÓN DEL TÉCNICO ==========
    pending_closure = "pending_closure"  # OT vencida sin cerrar (bloquea agenda del técnico)
    
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
# MODELO: Categorías de Ticket
# ===========================


class TicketCategory(Base, TimestampMixin):
    """Catálogo de categorías para clasificar tickets y sugerir prioridad."""
    __tablename__ = "ticket_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority_default: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum", native_enum=False),
        default=TicketPriority.medium,
        nullable=False,
        comment="Prioridad sugerida por defecto para esta categoría",
    )

    tickets: Mapped[list['Ticket']] = relationship("Ticket", back_populates="category", lazy="select")
    reasons: Mapped[list['TicketReason']] = relationship("TicketReason", back_populates="category", lazy="select")


# ===========================
# MODELO: Motivos de Ticket
# ===========================

class TicketReason(Base, TimestampMixin):
    """
    Motivos de ticket dependientes de la categoría.
    Permite clasificar tickets con motivos específicos según el tipo de gestión.
    
    Ejemplos:
    - Soporte Técnico: 'Sin Servicio', 'Intermitencia', 'Lentitud'
    - Baja de Servicio: 'Mudanza', 'Precio/Competencia'
    - Administrativo: 'Cambio de Plan', 'Facturación'
    """
    __tablename__ = "ticket_reasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, comment="ID único del motivo")
    name: Mapped[str] = mapped_column(String(150), nullable=False, comment="Nombre del motivo")
    category_id: Mapped[int] = mapped_column(
        ForeignKey("ticket_categories.id", name="fk_ticket_reasons_category_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Categoría a la que pertenece el motivo"
    )

    # Relaciones
    category: Mapped['TicketCategory'] = relationship("TicketCategory", back_populates="reasons", lazy="joined")
    tickets: Mapped[list['Ticket']] = relationship("Ticket", back_populates="reason", lazy="select")

    def __repr__(self) -> str:
        return f"<TicketReason(id={self.id}, name={self.name}, category_id={self.category_id})>"


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

    # Detalles de contacto del cliente (JSONB)
    connection_details: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Datos de contacto del cliente: {phone, client_name, client_dni, address, city, ...}"
    )

    # Categoría funcional del ticket
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ticket_categories.id", name="fk_tickets_category_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Categoría del ticket (clasificación funcional)",
    )

    # Motivo específico del ticket (dependiente de categoría)
    ticket_reason_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ticket_reasons.id", name="fk_tickets_reason_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Motivo específico del ticket (ej: 'Sin Servicio', 'Mudanza')",
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
    category: Mapped[Optional['TicketCategory']] = relationship(
        "TicketCategory",
        back_populates="tickets",
        lazy="joined",
    )
    reason: Mapped[Optional['TicketReason']] = relationship(
        "TicketReason",
        back_populates="tickets",
        lazy="joined",
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
    connection: Mapped[Optional[BeholderConnection]] = relationship(
        BeholderConnection,
        primaryjoin=lambda: foreign(Ticket.connection_id) == BeholderConnection.connection_id,
        viewonly=True,
        lazy="joined",
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
    engineering_tasks: Mapped[list["EngineeringTask"]] = relationship(
        "EngineeringTask",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan"
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

    Estados (actualizado para coordinación):
      PENDING_PLANNING → COORDINATED → SCHEDULED → IN_PROGRESS → COMPLETED (o FAILED)
                          ↓                ↓
                    (fecha con cliente) (+ cuadrilla asignada)

    Flujo típico coordinado:
      1. Operador crea OT desde ticket (estado: PENDING_PLANNING)
      2. Coordinador pacta fecha con cliente (estado: COORDINATED, scheduled_start definido)
      3. Coordinador asigna cuadrilla (estado: SCHEDULED, team_id definido)
      4. Técnico va a sitio y cambia a IN_PROGRESS
      5. Técnico completa trabajo, consume materiales (estado: COMPLETED)
      6. Sistema descuenta stock automáticamente

    Relaciones:
      - ticket: Ticket origen
      - technician: Usuario (técnico asignado individual, deprecated)
      - team: Cuadrilla asignada (NUEVO - reemplaza technician)
      - work_order_items: Materiales consumidos

    Campos especiales:
      - scheduled_at: Fecha/hora programada (deprecated, usar scheduled_start)
      - scheduled_start: Inicio pactado con cliente (timezone aware UTC)
      - scheduled_end: Fin estimado (calculado automáticamente)
      - estimated_duration: Duración estimada en minutos
      - coordination_notes: Notas para el técnico
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
        comment="Técnico asignado individual (deprecated, usar team_id)"
    )

    team_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("teams.id", name="fk_work_orders_team_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Cuadrilla asignada para esta OT (NULL si asignación individual legacy)"
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

    # Prioridad (heredada del ticket, pero modificable independientemente)
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum", native_enum=False),
        default=TicketPriority.medium,
        nullable=False,
        index=True,
        comment="Prioridad de la OT: critical, high, medium, low (heredada del ticket padre)"
    )

    # Planificación y ejecución
    scheduled_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Fecha/hora programada para la visita (deprecated, usar scheduled_start)"
    )

    # ===== COORDINACIÓN Y AGENDAMIENTO (NUEVO) =====
    
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Fecha/hora de inicio pactada con cliente (timezone aware UTC)"
    )

    scheduled_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Fecha/hora estimada de finalización (calculada automáticamente)"
    )

    estimated_duration: Mapped[int] = mapped_column(
        Integer,
        default=60,
        nullable=False,
        comment="Duración estimada de la tarea en minutos (default: 60min)"
    )

    coordination_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas para el técnico (ej: 'Llave en portería', 'Llamar antes de llegar')"
    )

    # ===== FIN COORDINACIÓN =====

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

    # ===== GEOLOCALIZACIÓN =====
    latitude: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 8), nullable=True,
        comment="Latitud para geolocalización de la dirección"
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 8), nullable=True,
        comment="Longitud para geolocalización de la dirección"
    )

    # Relationships
    ticket: Mapped[Ticket] = relationship(
        "Ticket",
        back_populates="work_orders",
        lazy="joined"
    )
    technician: Mapped[Optional[User]] = relationship(
        "User",
        lazy="joined",
        foreign_keys=[technician_id]
    )
    team: Mapped[Optional["Team"]] = relationship(
        "Team",
        back_populates="work_orders",
        lazy="joined",
        foreign_keys=[team_id]
    )
    work_order_items: Mapped[list[WorkOrderItem]] = relationship(
        "WorkOrderItem",
        back_populates="work_order",
        lazy="select",
        cascade="all, delete-orphan"
    )
    contact_attempts: Mapped[list["ContactAttempt"]] = relationship(
        "ContactAttempt",
        back_populates="work_order",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="ContactAttempt.created_at.desc()"
    )

    # Índices compuestos
    __table_args__ = (
        Index("ix_work_orders_ticket_status", "ticket_id", "status"),
        Index("ix_work_orders_technician", "technician_id"),
        Index("ix_work_orders_scheduled", "scheduled_at"),
        Index("ix_work_orders_team_scheduled", "team_id", "scheduled_start"),  # NUEVO índice para coordinación
    )

    def __repr__(self) -> str:
        return f"<WorkOrder(id={self.id}, type={self.ot_type}, status={self.status})>"

    @property
    def is_coordinated(self) -> bool:
        """Retorna True si tiene fecha pactada con cliente."""
        return self.scheduled_start is not None

    @property
    def is_team_assigned(self) -> bool:
        """Retorna True si tiene cuadrilla asignada."""
        return self.team_id is not None

    def calculate_scheduled_end(self) -> Optional[datetime]:
        """
        Calcula scheduled_end basado en scheduled_start + estimated_duration.
        
        Returns:
            datetime con zona horaria UTC o None si no hay scheduled_start
        """
        if not self.scheduled_start:
            return None
        from datetime import timedelta
        return self.scheduled_start + timedelta(minutes=self.estimated_duration)


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
