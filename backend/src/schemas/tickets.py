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


class TicketDetailResponse(TicketResponse):
    timeline: List[TimelineEventResponse] = Field(default_factory=list)
    work_orders: List[WorkOrderResponse] = Field(default_factory=list)
