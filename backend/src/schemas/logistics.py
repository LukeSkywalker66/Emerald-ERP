"""
Logistics Schemas - Validación y serialización para entregas y recepciones de materiales.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from src.models.logistics import DeliveryStatus, DeliveryItemSource, ReceiptItemCondition


# ============================================
# MATERIAL DELIVERY SCHEMAS
# ============================================

class MaterialDeliveryItemCreate(BaseModel):
    """Schema para crear/actualizar un item de entrega."""
    product_id: int
    quantity_proposed: float = 0
    quantity_delivered: float = 0
    is_serialized: bool = False
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    source: DeliveryItemSource = DeliveryItemSource.MANUAL
    notes: Optional[str] = None


class MaterialDeliveryItemResponse(BaseModel):
    """Schema de respuesta para un item de entrega."""
    id: int
    delivery_id: int
    product_id: int
    quantity_proposed: float
    quantity_delivered: float
    is_serialized: bool
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    source: DeliveryItemSource
    notes: Optional[str] = None
    created_at: datetime
    # Joineados
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    product_group_name: Optional[str] = None
    serial_validation_regex: Optional[str] = None
    product_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MaterialDeliveryCreate(BaseModel):
    """Schema para crear una nueva entrega."""
    team_id: int
    warehouse_from_id: int = Field(..., description="ID del depósito central")
    warehouse_to_id: int = Field(..., description="ID del almacén móvil")
    notes: Optional[str] = None


class MaterialDeliveryUpdate(BaseModel):
    """Schema para actualizar una entrega."""
    status: Optional[DeliveryStatus] = None
    notes: Optional[str] = None


class MaterialDeliveryResponse(BaseModel):
    """Schema de respuesta para una entrega."""
    id: int
    team_id: int
    warehouse_from_id: int
    warehouse_to_id: int
    status: DeliveryStatus
    proposal_generated_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    delivered_by_user_id: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Joineados
    team_name: Optional[str] = None
    warehouse_from_name: Optional[str] = None
    warehouse_to_name: Optional[str] = None
    delivered_by_name: Optional[str] = None
    items: List[MaterialDeliveryItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DeliveryProposalRequest(BaseModel):
    """Schema para solicitar generación de propuesta."""
    team_id: Optional[int] = Field(None, description="ID de cuadrilla (opcional, se obtiene de la delivery si existe)")
    date: Optional[str] = Field(None, description="Fecha en formato YYYY-MM-DD (default: hoy)")


class DeliveryProposalItem(BaseModel):
    """Item de propuesta generada (antes de guardar)."""
    product_id: int
    product_name: str
    product_sku: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    is_group_requirement: bool = False
    serial_validation_regex: Optional[str] = None
    product_type: Optional[str] = None
    is_composite: bool = False
    unit_size: Optional[float] = None
    unit_measure: Optional[str] = None
    composite_unit_label: Optional[str] = None
    display_unit: str = Field("u.", description="Unidad visible para esta propuesta")
    required_base_total: Optional[float] = Field(None, description="Requerimiento original en unidades base de la plantilla")
    available_in_mobile_base: Optional[float] = Field(None, description="Stock disponible en unidades base, solo para trazabilidad")
    available_in_mobile: float = 0
    required_total: float = 0
    deficit: float = 0
    suggested_quantity: float = 0
    suggested_composite_units: Optional[float] = Field(None, description="Cantidad en unidades compuestas (ej: 2 bobinas)")
    suggested_model_id: Optional[int] = Field(None, description="ID del producto sugerido (para serializados con múltiples modelos)")


class DeliveryProposalResponse(BaseModel):
    """Respuesta de la generación de propuesta."""
    team_id: int
    team_name: str
    vehicle_name: str
    work_orders_count: int
    generated_at: datetime
    effective_date: Optional[str] = None  # Fecha real usada (puede ser != hoy)
    items: List[DeliveryProposalItem]


# ============================================
# BARCODE SCAN SCHEMAS
# ============================================

class BarcodeScanRequest(BaseModel):
    """Schema para escanear un código de barra de producto."""
    product_code: str = Field(..., description="SKU o código de barra del producto")
    quantity: Optional[float] = Field(1.0, ge=0.1, description="Cantidad (para BULK)")
    force_add_outside_proposal: bool = Field(
        False,
        description="Permite agregar ítems fuera de propuesta aceptada cuando el operador lo confirma"
    )


class BarcodeScanResponse(BaseModel):
    """Respuesta de un escaneo exitoso."""
    success: bool
    product_id: int
    product_name: str
    product_sku: str
    delivery_item_id: Optional[int] = None
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    product_group_id: Optional[int] = None
    is_serialized: bool
    already_scanned: bool = False
    message: str


class SerialScanRequest(BaseModel):
    """Schema para escanear un serial de producto serializado."""
    product_id: int
    serial_number: str
    force_add_outside_proposal: bool = Field(
        False,
        description="Permite agregar serial fuera de propuesta aceptada cuando el operador lo confirma"
    )


class SerialScanResponse(BaseModel):
    """Respuesta de un escaneo de serial."""
    success: bool
    delivery_item_id: Optional[int] = None
    serial_item_id: int
    serial_number: str
    product_name: str
    already_scanned: bool = False
    message: str


class TrackedUnitLabelResponse(BaseModel):
    """Respuesta para impresión de etiquetas de unidades trazables."""
    serial_item_id: int
    serial_number: str
    barcode_svg: str


# ============================================
# MATERIAL RECEIPT SCHEMAS
# ============================================

class MaterialReceiptItemCreate(BaseModel):
    """Schema para crear un item de recepción."""
    product_id: int
    quantity: float = 1.0
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    condition: ReceiptItemCondition = ReceiptItemCondition.GOOD
    notes: Optional[str] = None


class MaterialReceiptItemResponse(BaseModel):
    """Schema de respuesta para un item de recepción."""
    id: int
    receipt_id: int
    product_id: int
    quantity: float
    serial_item_id: Optional[int] = None
    serial_number: Optional[str] = None
    condition: ReceiptItemCondition
    notes: Optional[str] = None
    created_at: datetime
    product_name: Optional[str] = None
    product_sku: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MaterialReceiptCreate(BaseModel):
    """Schema para crear una recepción."""
    team_id: int
    warehouse_from_id: int = Field(..., description="ID del almacén móvil")
    warehouse_to_id: int = Field(..., description="ID del depósito central")
    notes: Optional[str] = None


class MaterialReceiptResponse(BaseModel):
    """Schema de respuesta para una recepción."""
    id: int
    team_id: int
    warehouse_from_id: int
    warehouse_to_id: int
    received_at: datetime
    received_by_user_id: int
    notes: Optional[str] = None
    created_at: datetime
    team_name: Optional[str] = None
    warehouse_from_name: Optional[str] = None
    warehouse_to_name: Optional[str] = None
    received_by_name: Optional[str] = None
    items: List[MaterialReceiptItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
