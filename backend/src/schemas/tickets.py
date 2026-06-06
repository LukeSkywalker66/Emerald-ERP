"""Esquemas Pydantic para Tickets v2.0."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, Field

from src.models import TicketPriority, TicketStatus, WorkOrderType
from src.models.tickets import (
    TicketTimelineEventType,
    WorkOrderStatus,
    WorkOrderResolutionType,
    ResolutionCategory,
    TicketType,
    AdministrativeSubtype,
    TicketCategory,
)


# ===========================
# SCHEMAS: Tags
# ===========================


class TicketCategoryResponse(BaseModel):
    """Respuesta de categorías disponibles para tickets."""
    id: int
    name: str
    description: Optional[str] = None
    priority_default: TicketPriority

    model_config = ConfigDict(from_attributes=True)


class TicketReasonResponse(BaseModel):
    """Respuesta de motivos de ticket."""
    id: int
    name: str
    category_id: int

    model_config = ConfigDict(from_attributes=True)


class TagResponse(BaseModel):
    """Respuesta de información de etiqueta."""
    id: int
    name: str
    color: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    """Schema para crear una etiqueta."""
    name: str = Field(..., min_length=1, max_length=100, description="Nombre único de la etiqueta")
    color: str = Field(default='emerald', max_length=20, description="Color en Hex o nombre Tailwind")
    is_active: bool = Field(default=True, description="Etiqueta activa (visible en UI)")


# ===========================
# SCHEMAS: Timeline Events
# ===========================


class TimelineEventResponse(BaseModel):
    id: int
    event_type: TicketTimelineEventType
    content: str
    created_at: datetime
    author_name: Optional[str] = None
    meta_data: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class TicketUpdate(BaseModel):
    """Schema para actualización parcial de tickets."""
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_to_id: Optional[int] = None
    availability_note: Optional[str] = None


class TimelineEventCreate(BaseModel):
    """Schema para crear un evento en la cronología."""
    content: str = Field(..., min_length=1, description="Contenido de la nota")
    event_type: TicketTimelineEventType = Field(default=TicketTimelineEventType.note)


class WorkOrderCreate(BaseModel):
    ticket_id: int = Field(..., description="ID del ticket origen")
    ot_type: WorkOrderType = Field(..., description="Tipo de orden de trabajo")
    priority: Optional[str] = Field(None, description="Prioridad declarada")
    description: str = Field(..., min_length=3, description="Descripción obligatoria")
    operational_instruction: Optional[str] = Field(
        None,
        min_length=3,
        description="Instrucción operativa puntual para cuadrilla (fuente de verdad OT)",
    )
    notes: Optional[str] = Field(None, description="Notas opcionales del operador")
    latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
    longitude: Optional[float] = Field(None, description="Longitud de la ubicación")


class WorkOrderResponse(BaseModel):
    id: int
    status: WorkOrderStatus
    priority: Optional[TicketPriority] = TicketPriority.medium  # Default si no existe
    ot_type: WorkOrderType
    technician_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkOrderListResponse(BaseModel):
    """Respuesta resumida para listado de OTs."""
    id: int
    ticket_id: Optional[int] = None
    ticket_title: Optional[str] = None
    ticket: Optional["TicketResponse"] = None  # Objeto ticket completo
    ot_type: str
    status: str
    client_name: Optional[str] = None
    address: Optional[str] = None
    technician_name: Optional[str] = None
    
    # Campos existentes
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkOrderCompleteRequest(BaseModel):
    """Schema para completar una OT con inventario (POST /work-orders/{id}/complete)."""
    resolution_category: Optional[str] = Field(None, description="Categoría de resolución")
    resolution_notes: Optional[str] = Field(None, description="Notas de resolución")
    photo_urls: Optional[List[str]] = Field(default_factory=list, description="Fotos de evidencia")
    connection_note: Optional[str] = Field(None, description="Nota opcional para la conexión")


class WorkOrderUpdate(BaseModel):
    """Schema para actualización de WorkOrder (usado por técnicos Y coordinadores)."""
    status: Optional[WorkOrderStatus] = None
    priority: Optional[TicketPriority] = Field(None, description="Prioridad de la OT (modificable independientemente del ticket)")
    
    # NUEVOS campos de coordinación
    team_id: Optional[int] = Field(None, description="Cuadrilla asignada")
    scheduled_start: Optional[datetime] = Field(None, description="Inicio pactado con cliente (UTC)")
    scheduled_end: Optional[datetime] = Field(None, description="Fin estimado (auto-calculado o manual)")
    estimated_duration: Optional[int] = Field(None, ge=15, le=480, description="Duración en minutos (15-480)")
    coordination_notes: Optional[str] = Field(None, max_length=500, description="Notas para técnico")
    
    # Campos existentes
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_type: Optional[WorkOrderResolutionType] = None
    resolution_notes: Optional[str] = Field(
        None,
        min_length=10,
        max_length=1000,
        description="Notas de resolución (mín 10, máx 1000 caracteres al completar)"
    )
    resolution_category: Optional[ResolutionCategory] = Field(
        None,
        description="Categoría de resolución: infrastructure, equipment, configuration, other"
    )
    photo_urls: Optional[List[str]] = Field(
        None,
        description="URLs de fotos de evidencia"
    )
    custom_data: Optional[Dict[str, Any]] = None
    latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
    longitude: Optional[float] = Field(None, description="Longitud de la ubicación")


class WorkOrderItemCreate(BaseModel):
    """Schema para crear un item de material consumido."""
    product_id: int = Field(..., description="ID del producto en inventario")
    quantity: float = Field(..., gt=0, description="Cantidad consumida")
    serial_number: Optional[str] = Field(None, description="Serial si es trazable")
    notes: Optional[str] = None


class WorkOrderItemResponse(BaseModel):
    """Schema de respuesta para items de material."""
    id: int
    product_id: int
    quantity: float
    serial_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkOrderDetailResponse(BaseModel):
    """Schema detallado de WorkOrder (incluye items y ticket info)."""
    id: int
    ticket_id: int
    ot_type: WorkOrderType
    status: WorkOrderStatus
    priority: Optional[TicketPriority] = TicketPriority.medium  # Default si no existe
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    
    # NUEVOS campos de coordinación
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    estimated_duration: int = 60
    coordination_notes: Optional[str] = None
    
    # Campos existentes
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolution_type: Optional[WorkOrderResolutionType] = None
    resolution_notes: Optional[str] = None
    resolution_category: Optional[ResolutionCategory] = None
    photo_urls: Optional[List[str]] = None
    custom_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    latitude: Optional[float] = Field(None, description="Latitud de la ubicación")
    longitude: Optional[float] = Field(None, description="Longitud de la ubicación")
    created_at: datetime
    updated_at: datetime
    
    # Nested data
    items: List[WorkOrderItemResponse] = Field(default_factory=list)
    ticket_info: Optional[Dict[str, Any]] = None  # Subject, connection_id, etc.
    
    model_config = ConfigDict(from_attributes=True)


class TicketCreate(BaseModel):
    """Schema para creación de ticket (extensible para 5 flujos)."""
    subject: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    priority: TicketPriority = TicketPriority.medium
    category_id: Optional[int] = Field(None, description="Categoría asociada al ticket")
    ticket_reason_id: Optional[int] = Field(None, description="Motivo específico del ticket")
    
    # Tipo de ticket y flujo (NUEVO)
    ticket_type: TicketType = TicketType.technical
    administrative_subtype: Optional[AdministrativeSubtype] = None
    
    # Conexiones según tipo (NUEVO)
    connection_id: Optional[int] = Field(None, description="Conexión principal (TECHNICAL, WITHDRAWAL)")
    origin_connection_id: Optional[int] = Field(None, description="Conexión origen (RELOCATION)")
    destination_connection_id: Optional[int] = Field(None, description="Conexión destino (INSTALLATION, RELOCATION)")
    
    # Datos adicionales (NUEVO)
    installation_tech: Optional[str] = Field(None, description="Tecnología: fiber, wireless, hybrid")
    availability_note: Optional[str] = None
    
    # Datos opcionales para instalación (lookup directo en ISPCube)
    customer_dni: Optional[str] = Field(None, description="DNI/CUIT del cliente para sincronización post-creación")
    # Payloads entregados por el wizard (NO re-consultar en backend)
    ispcube_customer: Optional[Dict[str, Any]] = Field(None, description="JSON completo del cliente devuelto por ISPCube /api/customer")
    ispcube_connections: Optional[List[Dict[str, Any]]] = Field(None, description="Array de conexiones devuelto por ISPCube /api/customer")


class TicketResponse(BaseModel):
    id: int
    subject: str
    description: Optional[str] = None
    status: TicketStatus
    priority: TicketPriority
    ticket_type: TicketType  # NUEVO
    administrative_subtype: Optional[AdministrativeSubtype] = None  # NUEVO
    connection_id: Optional[int] = None
    origin_connection_id: Optional[int] = None  # NUEVO
    destination_connection_id: Optional[int] = None  # NUEVO
    installation_tech: Optional[str] = None  # NUEVO
    availability_note: Optional[str] = None
    contact_info: Optional[dict] = None  # JSONB con phone, client_name, address, city (renombrado para evitar conflicto)
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    client_name: Optional[str] = None
    client_dni: Optional[str] = None
    category_name: Optional[str] = None
    reason_name: Optional[str] = None
    tags: List[TagResponse] = Field(default_factory=list, description="Etiquetas asignadas al ticket")

    model_config = ConfigDict(from_attributes=True)


class ConnectionDetailsResponse(BaseModel):
    """Datos enriquecidos de la conexión asociada al ticket."""
    connection_id: Optional[int] = None
    pppoe_username: Optional[str] = None
    address: Optional[str] = None  # Dirección de la conexión, fallback a cliente
    phone: Optional[str] = None  # Teléfono del cliente
    client_name: Optional[str] = None
    client_dni: Optional[str] = None
    node_name: Optional[str] = None
    node_ip: Optional[str] = None
    plan_name: Optional[str] = None
    plan_speed: Optional[int] = None  # En Mbps

    model_config = ConfigDict(from_attributes=True)


class TicketAttachmentResponse(BaseModel):
    """Respuesta de información de adjunto."""
    id: int
    filename: str
    filepath: str
    content_type: str
    size: int
    created_at: datetime
    uploader_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(TicketResponse):
    connection_details: Optional[ConnectionDetailsResponse] = None
    timeline: List[TimelineEventResponse] = Field(default_factory=list)
    work_orders: List[WorkOrderResponse] = Field(default_factory=list)


# ===========================
# SCHEMAS: Connection Assets & Notes
# ===========================


class ConnectionAssetResponse(BaseModel):
    """Schema de respuesta para activos instalados en una conexión."""
    id: int
    connection_id: int
    serial_item_id: int
    product_id: int
    serial_number: str
    status: str
    installed_at: datetime
    removed_at: Optional[datetime] = None
    installed_by_wo_id: Optional[int] = None
    removed_by_wo_id: Optional[int] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConnectionNoteCreate(BaseModel):
    """Schema para crear una nota de conexión."""
    connection_id: int = Field(..., description="ID de la conexión")
    work_order_id: Optional[int] = Field(None, description="OT que genera la nota")
    note: str = Field(..., min_length=1, max_length=2000, description="Contenido de la nota")
    is_pinned: bool = Field(False, description="Si es una nota importante/destacada")


class ConnectionNoteResponse(BaseModel):
    """Schema de respuesta para notas de conexión."""
    id: int
    connection_id: int
    work_order_id: Optional[int] = None
    author_id: Optional[int] = None
    note: str
    is_pinned: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConnectionAssetsListResponse(BaseModel):
    """Lista de activos de una conexión con metadatos."""
    connection_id: int
    assets: List[ConnectionAssetResponse] = Field(default_factory=list)


class ConnectionNotesListResponse(BaseModel):
    """Lista de notas de una conexión."""
    connection_id: int
    notes: List[ConnectionNoteResponse] = Field(default_factory=list)
