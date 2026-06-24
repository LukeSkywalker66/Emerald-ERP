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
from src.schemas.fleet import VehicleSummary


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
    vehicle: Optional[VehicleSummary] = Field(
        None,
        description="Vehículo asociado (solo MOBILE). Populado via JOIN a tabla vehicles, no es columna propia."
    )
    
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
    min_stock_alert: float = Field(0, ge=0)
    description: Optional[str] = None
    # Nuevos campos
    group_id: Optional[int] = Field(None, description="ID del grupo de producto (ONU/ONT, Router, etc)")
    unit_size: Optional[float] = Field(None, ge=0, description="Tamaño de 1 unidad compuesta (ej: 300 para bobina drop)")
    unit_measure: Optional[str] = Field(None, max_length=20, description="Unidad de medida (m, units, pcs)")
    is_composite: bool = Field(False, description="Producto compuesto que se fracciona al consumir")
    composite_unit_label: Optional[str] = Field(None, max_length=50, description="Etiqueta de unidad compuesta (Bobina, Blister)")
    serial_validation_regex: Optional[str] = Field(
        None, max_length=255,
        description="Regex para validar seriales al registrar compras (ej: ^[A-Z0-9]{16}$)"
    )


class ProductCreate(ProductBase):
    """Schema para crear product."""
    pass


class ProductUpdate(BaseModel):
    """Schema para actualizar product."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    type: Optional[ProductType] = None
    category: Optional[str] = Field(None, max_length=100)
    min_stock_alert: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    # Nuevos campos
    group_id: Optional[int] = Field(None, description="ID del grupo de producto")
    unit_size: Optional[float] = Field(None, ge=0, description="Tamaño de 1 unidad compuesta")
    unit_measure: Optional[str] = Field(None, max_length=20, description="Unidad de medida")
    is_composite: Optional[bool] = None
    composite_unit_label: Optional[str] = Field(None, max_length=50, description="Etiqueta de unidad compuesta")


class ProductResponse(ProductBase):
    """Schema de respuesta para product."""
    id: int
    created_at: datetime
    updated_at: datetime
    group_name: Optional[str] = Field(None, description="Nombre del grupo (populado via JOIN)")
    specs: Optional[dict] = Field(None, description="Especificaciones técnicas (JSONB)")
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# PRODUCT GROUP SCHEMAS
# ============================================

class ProductGroupBase(BaseModel):
    """Schema base para grupo de producto."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True


class ProductGroupCreate(ProductGroupBase):
    """Schema para crear grupo de producto."""
    pass


class ProductGroupUpdate(BaseModel):
    """Schema para actualizar grupo de producto."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductGroupResponse(ProductGroupBase):
    """Schema de respuesta para grupo de producto."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================
# PRODUCT SPEC SCHEMAS
# ============================================

class ProductSpecUpdate(BaseModel):
    """Schema para actualizar especificaciones técnicas de un producto."""
    specs: dict = Field(..., description="Especificaciones técnicas en JSON")


class ProductSpecResponse(BaseModel):
    """Schema de respuesta para especificaciones técnicas."""
    product_id: int
    specs: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================
# PRODUCT CATEGORY SCHEMAS
# ============================================


class ProductCategoryResponse(BaseModel):
    """Schema de respuesta para categoría de producto."""
    id: int
    name: str
    is_active: bool

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
    is_generated_barcode: bool = False
    initial_quantity: Optional[float] = None
    remaining_quantity: Optional[float] = None
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
    is_composite: bool = False
    unit_size: Optional[float] = None
    unit_measure: Optional[str] = None
    composite_unit_label: Optional[str] = None
    display_unit: str = Field("u.", description="Unidad visible para el stock (u. por defecto, bobinas/blisters para compuestos)")
    
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
    user_id: Optional[int] = None
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

    Para productos compuestos, `quantity` representa unidades compuestas
    (bobinas, blisters, cajas), no unidades base.
    """
    product_id: int = Field(..., description="ID del producto BULK")
    warehouse_id: int = Field(..., description="ID del warehouse destino")
    quantity: float = Field(..., gt=0, description="Cantidad a ingresar. Para compuestos se expresa en unidades compuestas.")
    generate_barcodes: bool = Field(
        False,
        description="Si es true y el producto es compuesto, genera SerialItems con códigos propios en lugar de incrementar stock_bulk."
    )
    movement_type: MovementType = Field(
        default=MovementType.PURCHASE,
        description="Tipo de movimiento: PURCHASE (compra) o ADJUSTMENT (ajuste)"
    )
    reference: Optional[str] = Field(None, max_length=200, description="Referencia del ingreso (ej: factura, orden)")
    notes: Optional[str] = Field(None, description="Observaciones adicionales")


class StockAdjustmentResponse(BaseModel):
    """Respuesta de un ajuste de stock exitoso."""
    success: bool
    movement_id: Optional[int] = Field(None, description="ID de movimiento principal creado")
    stock_bulk_id: Optional[int] = Field(None, description="ID del registro de stock_bulk (creado o actualizado)")
    previous_quantity: float = Field(..., description="Cantidad anterior en stock")
    new_quantity: float = Field(..., description="Cantidad nueva después del ajuste")
    tracked_units_created: int = Field(0, description="Cantidad de unidades trazables generadas")
    generated_serial_item_ids: List[int] = Field(default_factory=list, description="IDs de serial_items generados")
    generated_barcodes: List[str] = Field(default_factory=list, description="Códigos de barra generados")
    message: str
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# STOCK ALERT SCHEMAS (OPTIMIZED ENDPOINT)
# ============================================

class StockAlertItem(BaseModel):
    """
    Ítem de alerta de stock — resultado del endpoint optimizado /stock/alerts.
    Reemplaza el N+1 masivo del frontend con una sola consulta agregada.
    """
    product_id: int
    product_name: str
    product_sku: str
    product_type: ProductType
    category: Optional[str] = None
    total_stock: float = Field(..., description="Suma total del stock en todos los warehouses")
    min_stock_alert: float = Field(..., description="Mínimo configurado antes de alertar")
    deficit: float = Field(..., description="Cuánto falta para alcanzar el mínimo")

    model_config = ConfigDict(from_attributes=True)


# ============================================
# BARCODE SCAN SCHEMAS (Escaneo inteligente)
# ============================================


class ScanCodeRequest(BaseModel):
    """
    Request para escanear un código de barra en contexto de compra.
    El motor identifica automáticamente si es SKU o Serial.
    """
    code: str = Field(
        ..., min_length=1, max_length=100,
        description="Código escaneado (SKU o serial)"
    )
    product_id: Optional[int] = Field(
        None, description="ID del producto (requerido si se espera serial)"
    )
    warehouse_id: Optional[int] = Field(
        None, description="ID del almacén destino (para crear sesión)"
    )


class ScanCodeResponse(BaseModel):
    """
    Respuesta del escaneo inteligente.
    El tipo de respuesta varía según lo identificado.
    """
    success: bool
    scan_type: str = Field(
        ..., description="Tipo identificado: PRODUCT_CODE | SERIAL_NUMBER | UNKNOWN"
    )
    code: str = Field(..., description="Código sanitizado")
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    is_serialized: Optional[bool] = None
    validated: bool = False
    message: str = ""

    model_config = ConfigDict(from_attributes=True)


class ScanSerialRequest(BaseModel):
    """
    Request para escanear un serial de producto SERIALIZED.
    Se envía después de identificar el producto.
    """
    serial_number: str = Field(
        ..., min_length=1, max_length=100,
        description="Número de serie escaneado"
    )
    product_id: int = Field(
        ..., description="ID del producto al que pertenece el serial"
    )
    warehouse_id: int = Field(
        ..., description="ID del almacén destino"
    )
    reference: Optional[str] = Field(
        None, max_length=200,
        description="Referencia de compra (factura, orden)"
    )
    notes: Optional[str] = None


class ScanSerialResponse(BaseModel):
    """Respuesta del escaneo de serial."""
    success: bool
    serial_number: str
    product_id: int
    product_name: Optional[str] = None
    already_scanned: bool = False
    session_id: Optional[int] = None
    session_count: int = 0
    validated: bool = False
    message: str = ""


class ScanSessionResponse(BaseModel):
    """Estado actual de una sesión de escaneo."""
    id: int
    warehouse_id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    scanned_sns: list = []
    count: int
    is_complete: bool
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanSessionConfirmResponse(BaseModel):
    """Respuesta de confirmación de sesión de escaneo."""
    success: bool
    session_id: int
    total_serials: int
    serials_created: int
    movements_created: int
    warehouse_name: Optional[str] = None
    product_name: Optional[str] = None
    message: str
