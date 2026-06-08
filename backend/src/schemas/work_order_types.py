"""Schemas for WorkOrderType configuration."""

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional


class WorkOrderTypeCreate(BaseModel):
    """Schema para crear un nuevo tipo de OT."""
    code: str = Field(..., min_length=1, max_length=50, description="Código interno único (snake_case)")
    name: str = Field(..., min_length=1, max_length=100, description="Nombre visible")
    description: Optional[str] = None
    color: str = "bg-zinc-600"
    icon: Optional[str] = None
    is_active: bool = True


class WorkOrderTypeUpdate(BaseModel):
    """Schema para actualizar un tipo de OT (nombre, color, icono)."""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


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
    """Schema para crear/actualizar un item de plantilla.
    
    Puede referenciar un producto específico (product_id) o un grupo (group_id).
    Si se especifica group_id, se ignora product_id.
    """
    product_id: Optional[int] = Field(None, description="Producto específico (si se conoce)")
    group_id: Optional[int] = Field(None, description="Grupo de producto (ej: ONU/ONT)")
    default_quantity: float = 1.0
    required: bool = False
    sort_order: int = 0
    notes: Optional[str] = None


class WOTemplateItemResponse(BaseModel):
    """Schema de respuesta para un item de plantilla."""
    id: int
    template_id: int
    product_id: Optional[int] = None
    group_id: Optional[int] = None
    default_quantity: float
    required: bool
    sort_order: int
    notes: Optional[str] = None
    product_name: Optional[str] = None  # joined from Product
    product_sku: Optional[str] = None
    group_name: Optional[str] = None  # joined from ProductGroup

    model_config = ConfigDict(from_attributes=True)


class WOTemplateCreate(BaseModel):
    """Schema para crear una plantilla."""
    name: str
    description: Optional[str] = None
    ot_type: Optional[str] = None
    action_code: Optional[str] = None
    is_active: bool = True
    items: list[WOTemplateItemCreate] = []


class WOTemplateUpdate(BaseModel):
    """Schema para actualizar una plantilla."""
    name: Optional[str] = None
    description: Optional[str] = None
    ot_type: Optional[str] = None
    action_code: Optional[str] = None
    is_active: Optional[bool] = None
    items: Optional[list[WOTemplateItemCreate]] = None


class WOTemplateResponse(BaseModel):
    """Schema de respuesta para una plantilla completa."""
    id: int
    name: str
    description: Optional[str] = None
    ot_type: Optional[str] = None
    action_code: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[WOTemplateItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ============================================
# Schemas: WO Actions (Resolution Actions)
# ============================================


class WOActionCreate(BaseModel):
    """Schema para crear una acción de resolución."""
    ot_type: str
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    requires_notes: bool = False
    is_active: bool = True
    sort_order: int = 0


class WOActionUpdate(BaseModel):
    """Schema para actualizar una acción de resolución."""
    name: Optional[str] = None
    description: Optional[str] = None
    requires_notes: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class WOActionResponse(BaseModel):
    """Schema de respuesta para una acción de resolución."""
    id: int
    ot_type: str
    code: str
    name: str
    description: Optional[str] = None
    requires_notes: bool
    is_active: bool
    sort_order: int
    is_builtin: bool

    model_config = ConfigDict(from_attributes=True)
