"""
Inventory Schemas - Validación y serialización para módulo de inventario
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from src.models.inventory import (
    WarehouseType,
    ProductType,
    SerialItemStatus,
    MovementType
)


# ============================================
# WAREHOUSE SCHEMAS
# ============================================

class WarehouseBase(BaseModel):
    """Schema base para warehouse."""
    name: str = Field(..., min_length=1, max_length=100)
    type: WarehouseType
    user_id: Optional[int] = Field(None, description="ID de técnico si es tipo MOBILE")


class WarehouseCreate(WarehouseBase):
    """Schema para crear warehouse."""
    pass


class WarehouseUpdate(BaseModel):
    """Schema para actualizar warehouse."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[WarehouseType] = None
    user_id: Optional[int] = None


class WarehouseResponse(WarehouseBase):
    """Schema de respuesta para warehouse."""
    id: int
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = Field(None, description="Nombre del técnico asignado si es MOBILE")
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# PRODUCT SCHEMAS
# ============================================

class ProductBase(BaseModel):
    """Schema base para product."""
    name: str = Field(..., min_length=1, max_length=200)
    sku: str = Field(..., min_length=1, max_length=50, description="Código único")
    type: ProductType
    category: Optional[str] = Field(None, max_length=100)
    min_stock_alert: int = Field(0, ge=0)
    description: Optional[str] = None


class ProductCreate(ProductBase):
    """Schema para crear product."""
    pass


class ProductUpdate(BaseModel):
    """Schema para actualizar product."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    type: Optional[ProductType] = None
    category: Optional[str] = Field(None, max_length=100)
    min_stock_alert: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None


class ProductResponse(ProductBase):
    """Schema de respuesta para product."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# STOCK BULK SCHEMAS
# ============================================

class StockBulkBase(BaseModel):
    """Schema base para stock bulk."""
    warehouse_id: int
    product_id: int
    quantity: float = Field(..., ge=0)


class StockBulkCreate(StockBulkBase):
    """Schema para crear stock bulk."""
    pass


class StockBulkUpdate(BaseModel):
    """Schema para actualizar stock bulk."""
    quantity: float = Field(..., ge=0)


class StockBulkResponse(StockBulkBase):
    """Schema de respuesta para stock bulk."""
    id: int
    created_at: datetime
    updated_at: datetime
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# SERIAL ITEM SCHEMAS
# ============================================

class SerialItemBase(BaseModel):
    """Schema base para serial item."""
    serial_number: str = Field(..., min_length=1, max_length=100)
    mac_address: Optional[str] = Field(None, max_length=17)
    product_id: int
    warehouse_id: int
    status: SerialItemStatus = SerialItemStatus.NEW
    ticket_related_id: Optional[int] = None
    notes: Optional[str] = None


class SerialItemCreate(SerialItemBase):
    """Schema para crear serial item."""
    pass


class SerialItemUpdate(BaseModel):
    """Schema para actualizar serial item."""
    serial_number: Optional[str] = Field(None, min_length=1, max_length=100)
    mac_address: Optional[str] = Field(None, max_length=17)
    warehouse_id: Optional[int] = None
    status: Optional[SerialItemStatus] = None
    ticket_related_id: Optional[int] = None
    notes: Optional[str] = None


class SerialItemResponse(SerialItemBase):
    """Schema de respuesta para serial item."""
    id: int
    created_at: datetime
    updated_at: datetime
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    warehouse_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# STOCK MOVEMENT SCHEMAS
# ============================================

class StockMovementBase(BaseModel):
    """Schema base para stock movement."""
    product_id: int
    from_warehouse_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None
    quantity: Optional[float] = Field(None, ge=0, description="Para productos BULK")
    serial_item_id: Optional[int] = Field(None, description="Para productos SERIALIZED")
    movement_type: MovementType
    reference: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    """Schema para crear stock movement."""
    pass


class StockMovementResponse(StockMovementBase):
    """Schema de respuesta para stock movement."""
    id: int
    date: datetime
    user_id: int
    user_name: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    from_warehouse_name: Optional[str] = None
    to_warehouse_name: Optional[str] = None
    serial_number: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# COMPOSITE SCHEMAS FOR STOCK VIEWS
# ============================================

class StockItemDetail(BaseModel):
    """Detalle unificado de stock (bulk o serializado)."""
    product_id: int
    product_name: str
    product_sku: str
    product_type: ProductType
    category: Optional[str] = None
    
    # Para BULK
    quantity: Optional[float] = None
    
    # Para SERIALIZED
    serial_items: Optional[List[SerialItemResponse]] = None
    serial_count: Optional[int] = Field(None, description="Conteo de seriales disponibles")
    
    model_config = ConfigDict(from_attributes=True)


class WarehouseStockResponse(BaseModel):
    """Respuesta completa de stock de un warehouse."""
    warehouse_id: int
    warehouse_name: str
    warehouse_type: WarehouseType
    items: List[StockItemDetail]
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# TRANSFER REQUEST SCHEMA
# ============================================

class StockTransferRequest(BaseModel):
    """
    Request para transferir stock entre depósitos.
    Valida que se especifique quantity XOR serial_item_ids según tipo de producto.
    """
    product_id: int
    from_warehouse_id: int
    to_warehouse_id: int
    
    # Para BULK (mutuamente excluyente con serial_item_ids)
    quantity: Optional[float] = Field(None, ge=0, description="Cantidad a transferir (solo para BULK)")
    
    # Para SERIALIZED (mutuamente excluyente con quantity)
    serial_item_ids: Optional[List[int]] = Field(None, description="IDs de seriales a transferir (solo para SERIALIZED)")
    
    reference: Optional[str] = Field(None, max_length=200, description="Referencia del movimiento")
    notes: Optional[str] = None


class StockTransferResponse(BaseModel):
    """Respuesta de una transferencia exitosa."""
    success: bool
    movements_created: List[int] = Field(default_factory=list, description="IDs de movimientos creados")
    message: str
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# STOCK ADJUSTMENT SCHEMAS
# ============================================

class StockAdjustmentRequest(BaseModel):
    """
    Request para ajustes de inventario (compras, ingresos, ajustes).
    Permite agregar stock BULK a un warehouse específico.
    """
    product_id: int = Field(..., description="ID del producto BULK")
    warehouse_id: int = Field(..., description="ID del warehouse destino")
    quantity: float = Field(..., gt=0, description="Cantidad a ingresar (debe ser > 0)")
    movement_type: MovementType = Field(
        default=MovementType.PURCHASE,
        description="Tipo de movimiento: PURCHASE (compra) o ADJUSTMENT (ajuste)"
    )
    reference: Optional[str] = Field(None, max_length=200, description="Referencia del ingreso (ej: factura, orden)")
    notes: Optional[str] = Field(None, description="Observaciones adicionales")


class StockAdjustmentResponse(BaseModel):
    """Respuesta de un ajuste de stock exitoso."""
    success: bool
    movement_id: int = Field(..., description="ID del movimiento creado")
    stock_bulk_id: int = Field(..., description="ID del registro de stock_bulk (creado o actualizado)")
    previous_quantity: float = Field(..., description="Cantidad anterior en stock")
    new_quantity: float = Field(..., description="Cantidad nueva después del ajuste")
    message: str
    
    model_config = ConfigDict(from_attributes=True)
