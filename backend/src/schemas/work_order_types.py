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


# ============================================
# Schemas: WO Templates (Material Suggestions)
# ============================================


class WOTemplateItemCreate(BaseModel):
    """Schema para crear/actualizar un item de plantilla."""
    product_id: int
    default_quantity: float = 1.0
    required: bool = False
    sort_order: int = 0
    notes: Optional[str] = None


class WOTemplateItemResponse(BaseModel):
    """Schema de respuesta para un item de plantilla."""
    id: int
    template_id: int
    product_id: int
    default_quantity: float
    required: bool
    sort_order: int
    notes: Optional[str] = None
    product_name: Optional[str] = None  # joined from Product
    product_sku: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WOTemplateCreate(BaseModel):
    """Schema para crear una plantilla."""
    name: str
    description: Optional[str] = None
    ot_type: Optional[str] = None
    is_active: bool = True
    items: list[WOTemplateItemCreate] = []


class WOTemplateUpdate(BaseModel):
    """Schema para actualizar una plantilla."""
    name: Optional[str] = None
    description: Optional[str] = None
    ot_type: Optional[str] = None
    is_active: Optional[bool] = None
    items: Optional[list[WOTemplateItemCreate]] = None


class WOTemplateResponse(BaseModel):
    """Schema de respuesta para una plantilla completa."""
    id: int
    name: str
    description: Optional[str] = None
    ot_type: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[WOTemplateItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
