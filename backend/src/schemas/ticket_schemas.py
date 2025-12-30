from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.models.ticket import TicketEventType, TicketPriority, TicketStatus
from src.schemas.user_schemas import UserResponse


class TicketCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    category_id: Optional[int] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    customer_id: Optional[int] = None


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to_id: Optional[int] = None


class TicketEventCreate(BaseModel):
    event_type: TicketEventType
    payload: Dict = Field(default_factory=dict)
    user_id: Optional[int] = None


class TicketEventOut(BaseModel):
    id: int
    event_type: TicketEventType
    payload: Dict
    created_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class TicketOut(TicketCreate):
    id: int
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    category: Optional[TicketCategoryOut] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetail(TicketOut):
    events: List[TicketEventOut] = Field(default_factory=list)
