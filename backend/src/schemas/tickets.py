"""Esquemas Pydantic para Tickets v2.0."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.models import TicketPriority, TicketStatus, WorkOrderType
from src.models.tickets import TicketTimelineEventType, WorkOrderStatus


class TimelineEventResponse(BaseModel):
    id: int
    event_type: TicketTimelineEventType
    content: str
    created_at: datetime
    author_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketUpdate(BaseModel):
    """Schema para actualización parcial de tickets."""
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_to_id: Optional[int] = None


class TimelineEventCreate(BaseModel):
    """Schema para crear un evento en la cronología."""
    content: str = Field(..., min_length=1, description="Contenido de la nota")
    event_type: TicketTimelineEventType = Field(default=TicketTimelineEventType.NOTE)


class WorkOrderCreate(BaseModel):
    ot_type: WorkOrderType = Field(..., description="Tipo de orden de trabajo")
    notes: Optional[str] = Field(None, description="Notas opcionales del operador")


class WorkOrderResponse(BaseModel):
    id: int
    status: WorkOrderStatus
    technician_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    connection_id: Optional[int] = None


class TicketResponse(BaseModel):
    id: int
    subject: str
    status: TicketStatus
    priority: TicketPriority
    connection_id: Optional[int] = None
    created_at: datetime
    creator_name: Optional[str] = None
    assigned_to_name: Optional[str] = None

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


class TicketDetailResponse(TicketResponse):
    connection_details: Optional[ConnectionDetailsResponse] = None
    timeline: List[TimelineEventResponse] = Field(default_factory=list)
    work_orders: List[WorkOrderResponse] = Field(default_factory=list)
