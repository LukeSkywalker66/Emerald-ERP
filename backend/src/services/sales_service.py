"""
Sales Service - Lógica de negocio del módulo de Ventas al Público.

En esta etapa, "vender" es una ACCIÓN DE STOCK: al confirmar una venta se
descuenta stock BULK o se marca como SOLD el serial vendido, y se registra un
`StockMovement` de tipo SALE. La facturación, el precio y el cliente formal son
capas futuras que se colgarán de `Sale` sin refactorizar esta lógica raíz.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.inventory import (
    MovementType,
    Product,
    ProductType,
    SerialItem,
    SerialItemStatus,
    StockBulk,
    StockMovement,
)
from src.models.sales import Sale, SaleItem, SaleStatus
from src.schemas.sales import SaleCreate


class SaleError(ValueError):
    """Error de dominio para operaciones de venta."""


def create_sale(db: Session, payload: SaleCreate, user_id: Optional[int]) -> Sale:
    """Crea una venta en DRAFT con sus líneas y le asigna el correlativo."""
    # Validar que el warehouse existe.
    from src.models.inventory import Warehouse
    warehouse = db.get(Warehouse, payload.warehouse_id)
    if not warehouse:
        raise SaleError(f"Depósito {payload.warehouse_id} no encontrado")

    # Validar productos y seriales antes de persistir.
    for line in payload.items:
        product = db.get(Product, line.product_id)
        if not product:
            raise SaleError(f"Producto {line.product_id} no encontrado")
        if product.type == ProductType.SERIALIZED and not line.serial_number:
            raise SaleError(
                f"El producto '{product.name}' es SERIALIZED: indicá el serial a vender"
            )

    sale = Sale(
        # Correlativo temporal (único) para satisfacer el NOT NULL antes del flush;
        # se reemplaza por el correlativo final una vez conocido el id.
        sale_number=f"TMP-{uuid.uuid4().hex[:12]}",
        warehouse_id=payload.warehouse_id,
        status=SaleStatus.DRAFT,
        reference=payload.reference,
        notes=payload.notes,
        seller_user_id=user_id,
    )
    db.add(sale)
    db.flush()

    sale.sale_number = f"VTA-{datetime.utcnow().year}-{sale.id:05d}"

    for line in payload.items:
        serial_item_id = None
        if line.serial_number:
            serial_item = db.execute(
                select(SerialItem).where(SerialItem.serial_number == line.serial_number.strip().upper())
            ).scalar_one_or_none()
            if not serial_item:
                raise SaleError(f"Serial '{line.serial_number}' no encontrado en el sistema")
            serial_item_id = serial_item.id

        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=line.product_id,
                quantity=line.quantity,
                serial_item_id=serial_item_id,
                notes=line.notes,
            )
        )

    db.flush()
    return sale


def confirm_sale(db: Session, sale_id: int, user_id: Optional[int]) -> int:
    """
    Confirma una venta: descuenta stock y registra movimientos SALE.

    Es transaccional: si cualquier línea no puede satisfacerse, se revierte todo.
    Retorna la cantidad de movimientos de stock creados.
    """
    sale = db.get(Sale, sale_id)
    if not sale:
        raise SaleError(f"Venta {sale_id} no encontrada")
    if sale.status != SaleStatus.DRAFT:
        raise SaleError(f"La venta {sale.sale_number} ya no está en borrador")

    if not sale.items:
        raise SaleError("La venta no tiene líneas")

    movements_created = 0

    for item in sale.items:
        product = item.product

        if product.type == ProductType.SERIALIZED:
            serial = db.get(SerialItem, item.serial_item_id) if item.serial_item_id else None
            if not serial:
                raise SaleError(
                    f"Falta el serial para '{product.name}' (producto SERIALIZED)"
                )
            if serial.product_id != product.id:
                raise SaleError(
                    f"El serial '{serial.serial_number}' no corresponde al producto '{product.name}'"
                )
            if serial.warehouse_id != sale.warehouse_id:
                raise SaleError(
                    f"El serial '{serial.serial_number}' no está en el depósito de la venta"
                )
            if serial.status not in (SerialItemStatus.NEW, SerialItemStatus.IN_VEHICLE):
                raise SaleError(
                    f"El serial '{serial.serial_number}' no está disponible (status: {serial.status.value})"
                )

            serial.status = SerialItemStatus.SOLD
            movement = StockMovement(
                product_id=product.id,
                from_warehouse_id=sale.warehouse_id,
                to_warehouse_id=None,
                quantity=1.0,
                serial_item_id=serial.id,
                movement_type=MovementType.SALE,
                reference=f"Venta {sale.sale_number}",
                user_id=user_id,
                notes=sale.notes,
            )
        else:
            stock = db.execute(
                select(StockBulk).where(
                    StockBulk.warehouse_id == sale.warehouse_id,
                    StockBulk.product_id == product.id,
                )
            ).scalar_one_or_none()

            if not stock or stock.quantity < item.quantity:
                available = stock.quantity if stock else 0
                raise SaleError(
                    f"Stock insuficiente de '{product.name}'. Disponible: {available}, "
                    f"solicitado: {item.quantity}"
                )

            stock.quantity -= item.quantity
            movement = StockMovement(
                product_id=product.id,
                from_warehouse_id=sale.warehouse_id,
                to_warehouse_id=None,
                quantity=item.quantity,
                serial_item_id=None,
                movement_type=MovementType.SALE,
                reference=f"Venta {sale.sale_number}",
                user_id=user_id,
                notes=sale.notes,
            )

        db.add(movement)
        movements_created += 1

    sale.status = SaleStatus.CONFIRMED
    return movements_created


def cancel_sale(db: Session, sale_id: int) -> Sale:
    """Anula una venta que todavía está en DRAFT."""
    sale = db.get(Sale, sale_id)
    if not sale:
        raise SaleError(f"Venta {sale_id} no encontrada")
    if sale.status != SaleStatus.DRAFT:
        raise SaleError(f"La venta {sale.sale_number} ya no se puede anular")
    sale.status = SaleStatus.CANCELLED
    return sale
