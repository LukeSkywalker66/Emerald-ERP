"""
Logistics Router - API endpoints para entregas y recepciones de materiales.
Gestiona el flujo completo de transferencia de materiales entre
depósito central y móviles de cuadrillas.
"""
from typing import List, Optional
from datetime import datetime, date
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, and_, func

from src.database import get_db
from src.models.inventory import (
    Product, Warehouse, StockBulk, SerialItem,
    ProductType, WarehouseType, SerialItemStatus
)
from src.models.logistics import (
    MaterialDelivery, MaterialDeliveryItem,
    MaterialReceipt, MaterialReceiptItem,
    DeliveryStatus, DeliveryItemSource, ReceiptItemCondition
)
from src.models.coordination import Team, TeamMember
from src.models.fleet import Vehicle
from src.models.user import User

from src.schemas.logistics import (
    MaterialDeliveryCreate, MaterialDeliveryUpdate, MaterialDeliveryResponse,
    MaterialDeliveryItemCreate, MaterialDeliveryItemResponse,
    DeliveryProposalRequest, DeliveryProposalResponse, DeliveryProposalItem,
    BarcodeScanRequest, BarcodeScanResponse,
    SerialScanRequest, SerialScanResponse,
    MaterialReceiptCreate, MaterialReceiptResponse,
    MaterialReceiptItemCreate, MaterialReceiptItemResponse,
)
from src.services.material_delivery_service import (
    generate_delivery_proposal,
    create_delivery_from_proposal,
    confirm_delivery,
)
from src.utils.audit import log_create, log_update

router = APIRouter(prefix="/logistics", tags=["logistics"])
logger = logging.getLogger("uvicorn.error")


def _get_user_id() -> int:
    """TODO: Extraer de JWT."""
    return 2


def _safe_user_name(user=None) -> Optional[str]:
    if user is None:
        return None
    return getattr(user, 'full_name', None) or getattr(user, 'username', None)


# ============================================
# HELPER: Convertir ORM a Response
# ============================================

def _delivery_to_response(delivery: MaterialDelivery) -> MaterialDeliveryResponse:
    """Convierte ORM a response con datos joineados."""
    return MaterialDeliveryResponse(
        id=delivery.id,
        team_id=delivery.team_id,
        warehouse_from_id=delivery.warehouse_from_id,
        warehouse_to_id=delivery.warehouse_to_id,
        status=delivery.status,
        proposal_generated_at=delivery.proposal_generated_at,
        delivered_at=delivery.delivered_at,
        delivered_by_user_id=delivery.delivered_by_user_id,
        notes=delivery.notes,
        created_at=delivery.created_at,
        updated_at=delivery.updated_at,
        team_name=delivery.team.name if delivery.team else None,
        warehouse_from_name=delivery.warehouse_from.name if delivery.warehouse_from else None,
        warehouse_to_name=delivery.warehouse_to.name if delivery.warehouse_to else None,
        delivered_by_name=_safe_user_name(delivery.delivered_by),
        items=[
            MaterialDeliveryItemResponse(
                id=item.id,
                delivery_id=item.delivery_id,
                product_id=item.product_id,
                quantity_proposed=item.quantity_proposed,
                quantity_delivered=item.quantity_delivered,
                is_serialized=item.is_serialized,
                serial_item_id=item.serial_item_id,
                serial_number=item.serial_number,
                source=item.source,
                notes=item.notes,
                created_at=item.created_at,
                product_name=item.product.name if item.product else None,
                product_sku=item.product.sku if item.product else None,
                product_group_name=item.product.group.name if item.product and item.product.group else None,
            )
            for item in (delivery.items or [])
        ]
    )


def _receipt_to_response(receipt: MaterialReceipt) -> MaterialReceiptResponse:
    """Convierte ORM a response con datos joineados."""
    return MaterialReceiptResponse(
        id=receipt.id,
        team_id=receipt.team_id,
        warehouse_from_id=receipt.warehouse_from_id,
        warehouse_to_id=receipt.warehouse_to_id,
        received_at=receipt.received_at,
        received_by_user_id=receipt.received_by_user_id,
        notes=receipt.notes,
        created_at=receipt.created_at,
        team_name=receipt.team.name if receipt.team else None,
        warehouse_from_name=receipt.warehouse_from.name if receipt.warehouse_from else None,
        warehouse_to_name=receipt.warehouse_to.name if receipt.warehouse_to else None,
        received_by_name=_safe_user_name(receipt.received_by),
        items=[
            MaterialReceiptItemResponse(
                id=item.id,
                receipt_id=item.receipt_id,
                product_id=item.product_id,
                quantity=item.quantity,
                serial_item_id=item.serial_item_id,
                serial_number=item.serial_number,
                condition=item.condition,
                notes=item.notes,
                created_at=item.created_at,
                product_name=item.product.name if item.product else None,
                product_sku=item.product.sku if item.product else None,
            )
            for item in (receipt.items or [])
        ]
    )


# ============================================
# DELIVERY ENDPOINTS
# ============================================


@router.get("/deliveries", response_model=List[MaterialDeliveryResponse])
def list_deliveries(
    team_id: Optional[int] = Query(None, description="Filtrar por cuadrilla"),
    status: Optional[DeliveryStatus] = Query(None, description="Filtrar por estado"),
    date_from: Optional[date] = Query(None, description="Desde fecha"),
    date_to: Optional[date] = Query(None, description="Hasta fecha"),
    db: Session = Depends(get_db)
):
    """Listar entregas de materiales con filtros opcionales."""
    stmt = select(MaterialDelivery).options(
        joinedload(MaterialDelivery.team),
        joinedload(MaterialDelivery.warehouse_from),
        joinedload(MaterialDelivery.warehouse_to),
        joinedload(MaterialDelivery.delivered_by),
        selectinload(MaterialDelivery.items).joinedload(MaterialDeliveryItem.product),
    )

    if team_id:
        stmt = stmt.where(MaterialDelivery.team_id == team_id)
    if status:
        stmt = stmt.where(MaterialDelivery.status == status)
    if date_from:
        stmt = stmt.where(MaterialDelivery.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(MaterialDelivery.created_at <= datetime.combine(date_to, datetime.max.time()))

    stmt = stmt.order_by(MaterialDelivery.created_at.desc())
    result = db.execute(stmt).scalars().unique().all()
    return [_delivery_to_response(d) for d in result]


@router.post("/deliveries", response_model=MaterialDeliveryResponse, status_code=status.HTTP_201_CREATED)
def create_delivery(
    payload: MaterialDeliveryCreate,
    db: Session = Depends(get_db)
):
    """Crear una nueva entrega de materiales en estado DRAFT."""
    # Validar team
    team = db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Cuadrilla no encontrada")

    # Validar warehouses
    wh_from = db.get(Warehouse, payload.warehouse_from_id)
    if not wh_from or wh_from.type != WarehouseType.CENTRAL:
        raise HTTPException(status_code=400, detail="El almacén origen debe ser CENTRAL")

    wh_to = db.get(Warehouse, payload.warehouse_to_id)
    if not wh_to or wh_to.type != WarehouseType.MOBILE:
        raise HTTPException(status_code=400, detail="El almacén destino debe ser MOBILE")

    delivery = MaterialDelivery(
        team_id=payload.team_id,
        warehouse_from_id=payload.warehouse_from_id,
        warehouse_to_id=payload.warehouse_to_id,
        status=DeliveryStatus.DRAFT,
        delivered_by_user_id=_get_user_id(),
        notes=payload.notes,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    # Recargar con relaciones
    delivery = db.execute(
        select(MaterialDelivery).options(
            joinedload(MaterialDelivery.team),
            joinedload(MaterialDelivery.warehouse_from),
            joinedload(MaterialDelivery.warehouse_to),
            joinedload(MaterialDelivery.delivered_by),
            selectinload(MaterialDelivery.items),
        ).where(MaterialDelivery.id == delivery.id)
    ).scalar_one()

    return _delivery_to_response(delivery)


@router.get("/deliveries/{delivery_id}", response_model=MaterialDeliveryResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db)
):
    """Obtener detalle de una entrega con sus items."""
    delivery = db.execute(
        select(MaterialDelivery).options(
            joinedload(MaterialDelivery.team),
            joinedload(MaterialDelivery.warehouse_from),
            joinedload(MaterialDelivery.warehouse_to),
            joinedload(MaterialDelivery.delivered_by),
            selectinload(MaterialDelivery.items).joinedload(MaterialDeliveryItem.product),
        ).where(MaterialDelivery.id == delivery_id)
    ).scalar_one_or_none()

    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    return _delivery_to_response(delivery)


@router.post("/deliveries/{delivery_id}/proposal", response_model=MaterialDeliveryResponse)
def generate_proposal(
    delivery_id: int,
    payload: Optional[DeliveryProposalRequest] = None,
    db: Session = Depends(get_db)
):
    """Generar o regenerar la propuesta de materiales para una entrega."""
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    try:
        proposal = generate_delivery_proposal(
            db=db,
            team_id=delivery.team_id,
            target_date=payload.date if payload and payload.date else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Limpiar items existentes (solo los PROPOSAL)
    existing_proposal_items = [
        item for item in delivery.items
        if item.source == DeliveryItemSource.PROPOSAL
    ]
    for item in existing_proposal_items:
        db.delete(item)

    # Crear nuevos items de propuesta
    for item_data in proposal["items"]:
        new_item = MaterialDeliveryItem(
            delivery_id=delivery.id,
            product_id=item_data["product_id"],
            quantity_proposed=item_data["suggested_quantity"],
            quantity_delivered=item_data["suggested_quantity"],
            is_serialized=item_data.get("product_type") == "SERIALIZED",
            source=DeliveryItemSource.PROPOSAL,
        )
        db.add(new_item)

    delivery.proposal_generated_at = datetime.utcnow()
    db.commit()

    # Recargar
    delivery = db.execute(
        select(MaterialDelivery).options(
            joinedload(MaterialDelivery.team),
            joinedload(MaterialDelivery.warehouse_from),
            joinedload(MaterialDelivery.warehouse_to),
            joinedload(MaterialDelivery.delivered_by),
            selectinload(MaterialDelivery.items).joinedload(MaterialDeliveryItem.product),
        ).where(MaterialDelivery.id == delivery.id)
    ).scalar_one()

    return _delivery_to_response(delivery)


@router.post("/deliveries/{delivery_id}/items", response_model=MaterialDeliveryItemResponse)
def add_delivery_item(
    delivery_id: int,
    payload: MaterialDeliveryItemCreate,
    db: Session = Depends(get_db)
):
    """Agregar un item manual a una entrega."""
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    if delivery.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="No se puede modificar una entrega completada")

    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    item = MaterialDeliveryItem(
        delivery_id=delivery.id,
        product_id=payload.product_id,
        quantity_proposed=payload.quantity_proposed,
        quantity_delivered=payload.quantity_delivered,
        is_serialized=payload.is_serialized,
        serial_item_id=payload.serial_item_id,
        serial_number=payload.serial_number,
        source=DeliveryItemSource.MANUAL,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return MaterialDeliveryItemResponse(
        id=item.id,
        delivery_id=item.delivery_id,
        product_id=item.product_id,
        quantity_proposed=item.quantity_proposed,
        quantity_delivered=item.quantity_delivered,
        is_serialized=item.is_serialized,
        serial_item_id=item.serial_item_id,
        serial_number=item.serial_number,
        source=item.source,
        notes=item.notes,
        created_at=item.created_at,
        product_name=product.name,
        product_sku=product.sku,
        product_group_name=product.group.name if product.group else None,
    )


@router.delete("/deliveries/{delivery_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_delivery_item(
    delivery_id: int,
    item_id: int,
    db: Session = Depends(get_db)
):
    """Eliminar un item de una entrega."""
    item = db.execute(
        select(MaterialDeliveryItem).where(
            MaterialDeliveryItem.id == item_id,
            MaterialDeliveryItem.delivery_id == delivery_id
        )
    ).scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    delivery = db.get(MaterialDelivery, delivery_id)
    if delivery and delivery.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="No se puede modificar una entrega completada")

    db.delete(item)
    db.commit()


@router.post("/deliveries/{delivery_id}/scan-barcode", response_model=BarcodeScanResponse)
def scan_barcode(
    delivery_id: int,
    payload: BarcodeScanRequest,
    db: Session = Depends(get_db)
):
    """Escanear código de barra de un producto en una entrega."""
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    # Buscar producto por SKU (case-insensitive)
    sku_upper = payload.product_code.strip().upper()
    product = db.execute(
        select(Product).where(Product.sku.ilike(sku_upper))
    ).scalar_one_or_none()

    if not product:
        # Intentar por nombre (case-insensitive)
        product = db.execute(
            select(Product).where(Product.name.ilike(f"%{payload.product_code}%"))
        ).scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail=f"Producto '{payload.product_code}' no encontrado")

    # Verificar si ya está escaneado
    existing_item = db.execute(
        select(MaterialDeliveryItem).where(
            MaterialDeliveryItem.delivery_id == delivery_id,
            MaterialDeliveryItem.product_id == product.id,
        )
    ).scalar_one_or_none()

    already_scanned = existing_item is not None

    if not already_scanned:
        # Agregar como item manual
        item = MaterialDeliveryItem(
            delivery_id=delivery.id,
            product_id=product.id,
            quantity_proposed=payload.quantity or 1.0,
            quantity_delivered=payload.quantity or 1.0,
            is_serialized=product.type == ProductType.SERIALIZED,
            source=DeliveryItemSource.MANUAL,
        )
        db.add(item)
        db.commit()

    return BarcodeScanResponse(
        success=True,
        product_id=product.id,
        product_name=product.name,
        product_sku=product.sku,
        is_serialized=product.type == ProductType.SERIALIZED,
        already_scanned=already_scanned,
        message=f"Producto '{product.name}' {'ya estaba' if already_scanned else 'agregado'} exitosamente"
    )


@router.post("/deliveries/{delivery_id}/scan-serial", response_model=SerialScanResponse)
def scan_serial(
    delivery_id: int,
    payload: SerialScanRequest,
    db: Session = Depends(get_db)
):
    """Escanear serial de un producto serializado en una entrega."""
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    # Buscar serial item
    serial_item = db.execute(
        select(SerialItem).where(
            SerialItem.serial_number == payload.serial_number,
            SerialItem.product_id == payload.product_id,
        )
    ).scalar_one_or_none()

    if not serial_item:
        raise HTTPException(
            status_code=404,
            detail=f"Serial '{payload.serial_number}' no encontrado para el producto"
        )

    # Verificar que esté disponible en el warehouse origen
    if serial_item.warehouse_id != delivery.warehouse_from_id:
        raise HTTPException(
            status_code=400,
            detail=f"Serial '{payload.serial_number}' no está disponible en el depósito origen"
        )

    # Verificar duplicado en esta entrega
    existing = db.execute(
        select(MaterialDeliveryItem).where(
            MaterialDeliveryItem.delivery_id == delivery_id,
            MaterialDeliveryItem.serial_number == payload.serial_number,
        )
    ).scalar_one_or_none()

    if existing:
        return SerialScanResponse(
            success=False,
            serial_item_id=serial_item.id,
            serial_number=payload.serial_number,
            product_name=serial_item.product.name if serial_item.product else "",
            already_scanned=True,
            message=f"Serial '{payload.serial_number}' ya fue escaneado en esta entrega"
        )

    # Agregar como item
    item = MaterialDeliveryItem(
        delivery_id=delivery.id,
        product_id=payload.product_id,
        quantity_proposed=1.0,
        quantity_delivered=1.0,
        is_serialized=True,
        serial_item_id=serial_item.id,
        serial_number=payload.serial_number,
        source=DeliveryItemSource.MANUAL,
    )
    db.add(item)
    db.commit()

    return SerialScanResponse(
        success=True,
        serial_item_id=serial_item.id,
        serial_number=payload.serial_number,
        product_name=serial_item.product.name if serial_item.product else "",
        already_scanned=False,
        message=f"Serial '{payload.serial_number}' escaneado exitosamente"
    )


@router.post("/deliveries/{delivery_id}/confirm", response_model=MaterialDeliveryResponse)
def confirm_delivery_endpoint(
    delivery_id: int,
    db: Session = Depends(get_db)
):
    """Confirmar una entrega y ejecutar la transferencia de stock."""
    try:
        delivery = confirm_delivery(
            db=db,
            delivery_id=delivery_id,
            user_id=_get_user_id()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Recargar con relaciones
    delivery = db.execute(
        select(MaterialDelivery).options(
            joinedload(MaterialDelivery.team),
            joinedload(MaterialDelivery.warehouse_from),
            joinedload(MaterialDelivery.warehouse_to),
            joinedload(MaterialDelivery.delivered_by),
            selectinload(MaterialDelivery.items).joinedload(MaterialDeliveryItem.product),
        ).where(MaterialDelivery.id == delivery.id)
    ).scalar_one()

    return _delivery_to_response(delivery)


@router.post("/deliveries/{delivery_id}/cancel", response_model=MaterialDeliveryResponse)
def cancel_delivery(
    delivery_id: int,
    db: Session = Depends(get_db)
):
    """Cancelar una entrega."""
    delivery = db.get(MaterialDelivery, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    if delivery.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="No se puede cancelar una entrega completada")

    delivery.status = DeliveryStatus.CANCELLED
    db.commit()
    db.refresh(delivery)

    return _delivery_to_response(delivery)


# ============================================
# RECEIPT ENDPOINTS
# ============================================


@router.get("/receipts", response_model=List[MaterialReceiptResponse])
def list_receipts(
    team_id: Optional[int] = Query(None, description="Filtrar por cuadrilla"),
    date_from: Optional[date] = Query(None, description="Desde fecha"),
    date_to: Optional[date] = Query(None, description="Hasta fecha"),
    db: Session = Depends(get_db)
):
    """Listar recepciones de materiales."""
    stmt = select(MaterialReceipt).options(
        joinedload(MaterialReceipt.team),
        joinedload(MaterialReceipt.warehouse_from),
        joinedload(MaterialReceipt.warehouse_to),
        joinedload(MaterialReceipt.received_by),
        selectinload(MaterialReceipt.items).joinedload(MaterialReceiptItem.product),
    )

    if team_id:
        stmt = stmt.where(MaterialReceipt.team_id == team_id)
    if date_from:
        stmt = stmt.where(MaterialReceipt.received_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(MaterialReceipt.received_at <= datetime.combine(date_to, datetime.max.time()))

    stmt = stmt.order_by(MaterialReceipt.received_at.desc())
    result = db.execute(stmt).scalars().unique().all()
    return [_receipt_to_response(r) for r in result]


@router.post("/receipts", response_model=MaterialReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_receipt(
    payload: MaterialReceiptCreate,
    db: Session = Depends(get_db)
):
    """Crear una nueva recepción de materiales."""
    receipt = MaterialReceipt(
        team_id=payload.team_id,
        warehouse_from_id=payload.warehouse_from_id,
        warehouse_to_id=payload.warehouse_to_id,
        received_by_user_id=_get_user_id(),
        notes=payload.notes,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    receipt = db.execute(
        select(MaterialReceipt).options(
            joinedload(MaterialReceipt.team),
            joinedload(MaterialReceipt.warehouse_from),
            joinedload(MaterialReceipt.warehouse_to),
            joinedload(MaterialReceipt.received_by),
            selectinload(MaterialReceipt.items),
        ).where(MaterialReceipt.id == receipt.id)
    ).scalar_one()

    return _receipt_to_response(receipt)


@router.get("/receipts/{receipt_id}", response_model=MaterialReceiptResponse)
def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db)
):
    """Obtener detalle de una recepción."""
    receipt = db.execute(
        select(MaterialReceipt).options(
            joinedload(MaterialReceipt.team),
            joinedload(MaterialReceipt.warehouse_from),
            joinedload(MaterialReceipt.warehouse_to),
            joinedload(MaterialReceipt.received_by),
            selectinload(MaterialReceipt.items).joinedload(MaterialReceiptItem.product),
        ).where(MaterialReceipt.id == receipt_id)
    ).scalar_one_or_none()

    if not receipt:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")

    return _receipt_to_response(receipt)


@router.post("/receipts/{receipt_id}/scan", response_model=dict)
def scan_receipt_item(
    receipt_id: int,
    payload: BarcodeScanRequest,
    db: Session = Depends(get_db)
):
    """Escanear un producto para recepción de materiales."""
    receipt = db.get(MaterialReceipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")

    product = db.execute(
        select(Product).where(Product.sku == payload.product_code)
    ).scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Crear item de recepción
    item = MaterialReceiptItem(
        receipt_id=receipt.id,
        product_id=product.id,
        quantity=payload.quantity or 1.0,
        condition=ReceiptItemCondition.GOOD,
    )
    db.add(item)
    db.commit()

    return {
        "success": True,
        "product_id": product.id,
        "product_name": product.name,
        "message": f"Producto '{product.name}' recibido"
    }


@router.post("/receipts/{receipt_id}/confirm", response_model=MaterialReceiptResponse)
def confirm_receipt(
    receipt_id: int,
    db: Session = Depends(get_db)
):
    """Confirmar una recepción y ejecutar la transferencia de stock."""
    receipt = db.execute(
        select(MaterialReceipt).options(
            selectinload(MaterialReceipt.items),
        ).where(MaterialReceipt.id == receipt_id)
    ).scalar_one_or_none()

    if not receipt:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")

    # Ejecutar transferencia inversa (MOBILE → CENTRAL)
    from src.services.inventory_service import transfer_stock_bulk, transfer_stock_serial

    for item in receipt.items:
        if item.quantity <= 0:
            continue

        if item.serial_item_id:
            transfer_stock_serial(
                db=db,
                serial_item_id=item.serial_item_id,
                from_warehouse_id=receipt.warehouse_from_id,
                to_warehouse_id=receipt.warehouse_to_id,
                user_id=_get_user_id(),
                reference=f"Recepción #{receipt.id}",
                notes=item.notes
            )
        else:
            transfer_stock_bulk(
                db=db,
                product_id=item.product_id,
                quantity=item.quantity,
                from_warehouse_id=receipt.warehouse_from_id,
                to_warehouse_id=receipt.warehouse_to_id,
                user_id=_get_user_id(),
                reference=f"Recepción #{receipt.id}",
                notes=item.notes
            )

    db.commit()

    receipt = db.execute(
        select(MaterialReceipt).options(
            joinedload(MaterialReceipt.team),
            joinedload(MaterialReceipt.warehouse_from),
            joinedload(MaterialReceipt.warehouse_to),
            joinedload(MaterialReceipt.received_by),
            selectinload(MaterialReceipt.items).joinedload(MaterialReceiptItem.product),
        ).where(MaterialReceipt.id == receipt.id)
    ).scalar_one()

    return _receipt_to_response(receipt)


# ============================================
# PROPOSAL PREVIEW (sin guardar)
# ============================================


@router.get("/proposal-preview", response_model=DeliveryProposalResponse)
def preview_proposal(
    team_id: int = Query(..., description="ID de la cuadrilla"),
    date_str: Optional[str] = Query(None, description="Fecha YYYY-MM-DD (default: hoy)"),
    db: Session = Depends(get_db)
):
    """Vista previa de la propuesta de materiales sin crear una entrega."""
    target_date = None
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")

    try:
        proposal = generate_delivery_proposal(
            db=db,
            team_id=team_id,
            target_date=target_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DeliveryProposalResponse(
        team_id=proposal["team_id"],
        team_name=proposal["team_name"],
        vehicle_name=proposal["vehicle_name"],
        work_orders_count=proposal["work_orders_count"],
        generated_at=proposal["generated_at"],
        items=[
            DeliveryProposalItem(**item)
            for item in proposal["items"]
        ]
    )
