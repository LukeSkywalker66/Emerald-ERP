"""
Sales Router - API endpoints del módulo de Ventas al Público.

En esta etapa la venta es una acción de stock: al confirmar se descuenta
inventario (BULK) o se marca SOLD (SERIALIZED) y se registran movimientos SALE.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.sales import Sale, SaleStatus
from src.schemas.sales import (
    SaleConfirmResponse,
    SaleCreate,
    SaleItemResponse,
    SaleResponse,
)
from src.services.sales_service import (
    SaleError,
    cancel_sale,
    confirm_sale,
    create_sale,
)

router = APIRouter(prefix="/sales", tags=["sales"])


def _get_user_id() -> int:
    # TODO: Extraer de JWT/session como en el resto del backend.
    return 2


def _sale_to_response(sale: Sale) -> SaleResponse:
    """Convierte una venta ORM en su respuesta, incluyendo detalles de líneas."""
    items = [
        SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else None,
            product_sku=item.product.sku if item.product else None,
            quantity=item.quantity,
            serial_item_id=item.serial_item_id,
            serial_number=item.serial_item.serial_number if item.serial_item else None,
            notes=item.notes,
        )
        for item in sale.items
    ]

    return SaleResponse(
        id=sale.id,
        sale_number=sale.sale_number,
        warehouse_id=sale.warehouse_id,
        warehouse_name=sale.warehouse.name if sale.warehouse else None,
        status=sale.status,
        reference=sale.reference,
        notes=sale.notes,
        seller_user_id=sale.seller_user_id,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items,
    )


@router.get("", response_model=List[SaleResponse])
def list_sales(
    sale_status: Optional[SaleStatus] = Query(None, alias="status", description="Filtrar por estado"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Lista ventas (más recientes primero), con opción de filtrar por estado."""
    stmt = select(Sale).order_by(Sale.id.desc()).limit(limit).offset(offset)
    if sale_status is not None:
        stmt = stmt.where(Sale.status == sale_status)
    sales = db.execute(stmt).scalars().all()
    return [_sale_to_response(s) for s in sales]


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    """Detalle de una venta con sus líneas."""
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail=f"Venta {sale_id} no encontrada")
    return _sale_to_response(sale)


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale_endpoint(payload: SaleCreate, db: Session = Depends(get_db)):
    """Crea una venta en borrador (aún no descuenta stock)."""
    try:
        sale = create_sale(db, payload, _get_user_id())
        db.commit()
        db.refresh(sale)
        return _sale_to_response(sale)
    except SaleError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{sale_id}/confirm", response_model=SaleConfirmResponse)
def confirm_sale_endpoint(sale_id: int, db: Session = Depends(get_db)):
    """Confirma la venta: descuenta stock y crea movimientos SALE (transaccional)."""
    try:
        movements = confirm_sale(db, sale_id, _get_user_id())
        db.commit()
        sale = db.get(Sale, sale_id)
        return SaleConfirmResponse(
            success=True,
            sale_id=sale.id,
            sale_number=sale.sale_number,
            movements_created=movements,
            message=f"Venta {sale.sale_number} confirmada: {movements} movimiento(s) de stock",
        )
    except SaleError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{sale_id}/cancel", response_model=SaleResponse)
def cancel_sale_endpoint(sale_id: int, db: Session = Depends(get_db)):
    """Anula una venta que todavía está en borrador."""
    try:
        sale = cancel_sale(db, sale_id)
        db.commit()
        db.refresh(sale)
        return _sale_to_response(sale)
    except SaleError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
