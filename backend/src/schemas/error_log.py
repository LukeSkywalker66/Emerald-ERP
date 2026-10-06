"""
Schemas para el registro de errores (error_logs).
"""
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ErrorLogCreate(BaseModel):
    """Payload para reportar un error (desde frontend o handlers internos)."""
    level: str = Field("ERROR", max_length=20)
    source: str = Field("frontend", max_length=20)
    module: Optional[str] = Field(None, max_length=120)
    message: str = Field(..., max_length=4000)
    stack_trace: Optional[str] = None
    user_id: Optional[int] = None
    request_method: Optional[str] = Field(None, max_length=10)
    request_path: Optional[str] = Field(None, max_length=255)
    status_code: Optional[int] = None
    context: Optional[dict] = None


class ErrorLogResponse(ErrorLogCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ErrorLogListResponse(BaseModel):
    items: list[ErrorLogResponse]
    total: int
    limit: int
    offset: int
