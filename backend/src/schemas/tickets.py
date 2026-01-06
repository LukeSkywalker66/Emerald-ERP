"""Esquemas Pydantic para Tickets v2.0."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, Field

from src.models import TicketPriority, TicketStatus, WorkOrderType
from src.models.tickets import TicketTimelineEventType, WorkOrderStatus, WorkOrderResolutionType


# ===========================
# SCHEMAS: Tags
# ===========================

class TagResponse(BaseModel):
    """Respuesta de información de etiqueta."""
    id: int
    name: str
    color: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    """Schema para crear una etiqueta."""
    name: str = Field(..., min_length=1, max_length=100, description="Nombre único de la etiqueta")
    color: str = Field(default='emerald', max_length=20, description="Color en Hex o nombre Tailwind")
    is_active: bool = Field(default=True, description="Etiqueta activa (visible en UI)")


# ===========================
# SCHEMAS: Timeline Events
# ===========================


class TimelineEventResponse(BaseModel):
    id: int
    event_type: TicketTimelineEventType
    content: str
    created_at: datetime
    author_name: Optional[str] = None
    meta_data: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TicketUpdate(BaseModel):
    """Schema para actualización parcial de tickets."""
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_to_id: Optional[int] = None
    availability_note: Optional[str] = None


class TimelineEventCreate(BaseModel):
    """Schema para crear un evento en la cronología."""
    content: str = Field(..., min_length=1, description="Contenido de la nota")
    event_type: TicketTimelineEventType = Field(default=TicketTimelineEventType.note)


class WorkOrderCreate(BaseModel):
    ot_type: WorkOrderType = Field(..., description="Tipo de orden de trabajo")
    notes: Optional[str] = Field(None, description="Notas opcionales del operador")


class WorkOrderResponse(BaseModel):
    id: int
    status: WorkOrderStatus
    ot_type: WorkOrderType
    technician_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkOrderUpdate(BaseModel):
    """Schema para actualización de WorkOrder (usado por técnicos)."""
    status: Optional[WorkOrderStatus] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_type: Optional[WorkOrderResolutionType] = None
    resolution_notes: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class WorkOrderItemCreate(BaseModel):
    """Schema para crear un item de material consumido."""
    product_id: int = Field(..., description="ID del producto en inventario")
    quantity: float = Field(..., gt=0, description="Cantidad consumida")
    serial_number: Optional[str] = Field(None, description="Serial si es trazable")
    notes: Optional[str] = None


class WorkOrderItemResponse(BaseModel):
    """Schema de respuesta para items de material."""
    id: int
    product_id: int
    quantity: float
    serial_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkOrderDetailResponse(BaseModel):
    """Schema detallado de WorkOrder (incluye items y ticket info)."""
    id: int
    ticket_id: int
    ot_type: WorkOrderType
    status: WorkOrderStatus
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_type: Optional[WorkOrderResolutionType] = None
    resolution_notes: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Nested data
    items: List[WorkOrderItemResponse] = Field(default_factory=list)
    ticket_info: Optional[Dict[str, Any]] = None  # Subject, connection_id, etc.
    
    model_config = ConfigDict(from_attributes=True)


class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    priority: TicketPriority = TicketPriority.medium
    connection_id: Optional[int] = None
    availability_note: Optional[str] = None


class TicketResponse(BaseModel):
    id: int
    subject: str
    status: TicketStatus
    priority: TicketPriority
    connection_id: Optional[int] = None
    availability_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    client_name: Optional[str] = None
    client_dni: Optional[str] = None
    tags: List[TagResponse] = Field(default_factory=list, description="Etiquetas asignadas al ticket")

    model_config = ConfigDict(from_attributes=True)


class ConnectionDetailsResponse(BaseModel):
    """Datos enriquecidos de la conexión asociada al ticket."""
    connection_id: Optional[int] = None
    pppoe_username: Optional[str] = None
    address: Optional[str] = None  # Dirección de la conexión, fallback a cliente
    phone: Optional[str] = None  # Teléfono del cliente
    client_name: Optional[str] = None
    client_dni: Optional[str] = None
    node_name: Optional[str] = None
    node_ip: Optional[str] = None
    plan_name: Optional[str] = None
    plan_speed: Optional[int] = None  # En Mbps

    model_config = ConfigDict(from_attributes=True)


class TicketAttachmentResponse(BaseModel):
    """Respuesta de información de adjunto."""
    id: int
    filename: str
    filepath: str
    content_type: str
    size: int
    created_at: datetime
    uploader_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(TicketResponse):
    connection_details: Optional[ConnectionDetailsResponse] = None
    timeline: List[TimelineEventResponse] = Field(default_factory=list)
    work_orders: List[WorkOrderResponse] = Field(default_factory=list)
