"""
Sales Schemas - Validación y serialización del módulo de Ventas al Público.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.models.sales import SaleStatus


class SaleItemCreate(BaseModel):
    """Línea de venta al crear una venta."""
    product_id: int
    quantity: float = Field(1, gt=0, description="Cantidad (1 para SERIALIZED)")
    serial_number: Optional[str] = Field(
        None, description="Serial vendido (obligatorio si el producto es SERIALIZED)"
    )
    notes: Optional[str] = None


class SaleCreate(BaseModel):
    """Request para crear una venta (borrador)."""
    warehouse_id: int = Field(..., description="Depósito que descuenta stock")
    reference: Optional[str] = Field(
        None, max_length=200, description="Texto libre: comprador, comprobante externo, etc."
    )
    notes: Optional[str] = None
    items: List[SaleItemCreate] = Field(..., min_length=1, description="Líneas de la venta")


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: float
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    notes: Optional[str] = None


class SaleResponse(BaseModel):
    id: int
    sale_number: str
    warehouse_id: int
    warehouse_name: Optional[str] = None
    status: SaleStatus
    reference: Optional[str] = None
    notes: Optional[str] = None
    seller_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: List[SaleItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SaleConfirmResponse(BaseModel):
    """Respuesta al confirmar una venta."""
    success: bool
    sale_id: int
    sale_number: str
    movements_created: int
    message: str
