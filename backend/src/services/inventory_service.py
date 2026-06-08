"""
Inventory Service - Funciones helper para operaciones de stock.
Usadas por material_delivery_service y otros módulos.
"""
from __future__ import annotations
from typing import Optional
import logging

from sqlalchemy.orm import Session
from sqlalchemy import select

from src.models.inventory import (
    StockBulk, SerialItem, StockMovement,
    MovementType, SerialItemStatus
)

logger = logging.getLogger("uvicorn.error")


def transfer_stock_bulk(
    db: Session,
    product_id: int,
    quantity: float,
    from_warehouse_id: int,
    to_warehouse_id: int,
    user_id: int,
    reference: Optional[str] = None,
    notes: Optional[str] = None
):
    """Transfiere stock BULK entre almacenes."""
    # Descontar del origen
    from_stock = db.execute(
        select(StockBulk).where(
            StockBulk.warehouse_id == from_warehouse_id,
            StockBulk.product_id == product_id
        )
    ).scalar_one_or_none()

    if not from_stock or from_stock.quantity < quantity:
        raise ValueError(f"Stock insuficiente en origen para producto {product_id}")

    from_stock.quantity -= quantity

    # Agregar al destino
    to_stock = db.execute(
        select(StockBulk).where(
            StockBulk.warehouse_id == to_warehouse_id,
            StockBulk.product_id == product_id
        )
    ).scalar_one_or_none()

    if to_stock:
        to_stock.quantity += quantity
    else:
        to_stock = StockBulk(
            warehouse_id=to_warehouse_id,
            product_id=product_id,
            quantity=quantity
        )
        db.add(to_stock)

    # Registrar movimiento
    movement = StockMovement(
        product_id=product_id,
        from_warehouse_id=from_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        quantity=quantity,
        movement_type=MovementType.TRANSFER,
        reference=reference or f"Transferencia interna",
        notes=notes,
        user_id=user_id
    )
    db.add(movement)
    db.flush()


def transfer_stock_serial(
    db: Session,
    serial_item_id: int,
    from_warehouse_id: int,
    to_warehouse_id: int,
    user_id: int,
    reference: Optional[str] = None,
    notes: Optional[str] = None
):
    """Transfiere un item serializado entre almacenes."""
    serial_item = db.get(SerialItem, serial_item_id)
    if not serial_item:
        raise ValueError(f"Serial item {serial_item_id} no encontrado")

    if serial_item.warehouse_id != from_warehouse_id:
        raise ValueError(
            f"Serial item {serial_item_id} no está en el almacén origen"
        )

    old_warehouse_id = serial_item.warehouse_id
    serial_item.warehouse_id = to_warehouse_id

    # Registrar movimiento
    movement = StockMovement(
        product_id=serial_item.product_id,
        from_warehouse_id=old_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        serial_item_id=serial_item.id,
        movement_type=MovementType.TRANSFER,
        reference=reference or f"Transferencia serial",
        notes=notes,
        user_id=user_id
    )
    db.add(movement)
    db.flush()
