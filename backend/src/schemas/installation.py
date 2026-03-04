"""Schemas for installation-related endpoints."""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class InstallationTypeResponse(BaseModel):
    """Response schema for installation type."""
    
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
