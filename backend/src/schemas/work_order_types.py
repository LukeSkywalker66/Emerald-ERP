"""Schemas for WorkOrderType configuration."""

from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class WorkOrderTypeResponse(BaseModel):
    """Response schema for a work order type configuration."""

    id: int
    code: str
    name: str
    description: Optional[str] = None
    color: str
    icon: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
