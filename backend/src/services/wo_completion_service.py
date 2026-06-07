"""
wo_completion_service - Lógica de negocio para completar una OT.

Orquesta en una sola transacción:
  1. Validación de stock suficiente
  2. Descarga de stock BULK del warehouse del técnico
  3. Actualización de SerialItem (status, connection_id)
  4. Creación de ConnectionAsset (trazabilidad)
  5. Registro de StockMovement (auditoría)
  6. Actualización de la OT (status, completed_at, resolución)
  7. Evento de timeline
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from src.models.tickets import (
    WorkOrder,
    WorkOrderItem,
    WorkOrderStatus,
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
)
from src.models.inventory import (
    StockBulk,
    SerialItem,
    SerialItemStatus,
    StockMovement,
    MovementType,
    ConnectionAsset,
    ConnectionAssetStatus,
    ConnectionNote,
)
from src.models.user import User
from src.models.beholder import Connection

logger = logging.getLogger(__name__)


class CompletionError(Exception):
    """Error controlado durante el proceso de cierre de OT."""
    pass


def complete_work_order_with_inventory(
    db: Session,
    work_order: WorkOrder,
    current_user: User,
    *,
    resolution_category: Optional[str] = None,
    resolution_notes: Optional[str] = None,
    photo_urls: Optional[list[str]] = None,
    connection_note: Optional[str] = None,
) -> WorkOrder:
    """
    Completar una OT procesando todo el inventario asociado.

    Args:
        db: Sesión de base de datos
        work_order: OT a completar (debe venir con work_order_items cargados)
        current_user: Usuario que ejecuta el cierre
        resolution_category: Categoría de resolución
        resolution_notes: Notas de resolución
        photo_urls: URLs de fotos de evidencia
        connection_note: Nota opcional para la conexión

    Returns:
        WorkOrder actualizada

    Raises:
        CompletionError: Si hay errores de validación (stock, permisos, etc.)
    """
    # ============================================================
    # 1. Validaciones previas
    # ============================================================
    if work_order.status == WorkOrderStatus.completed:
        raise CompletionError("La OT ya está completada")

    if work_order.status == WorkOrderStatus.failed:
        raise CompletionError("La OT está marcada como fallida")

    # Obtener connection_id desde el ticket asociado
    ticket = db.query(Ticket).filter(Ticket.id == work_order.ticket_id).first()
    if not ticket:
        raise CompletionError("Ticket asociado no encontrado")

    connection_id = ticket.connection_id
    if not connection_id:
        raise CompletionError(
            "El ticket no tiene una conexión asociada. "
            "No se puede trazar el inventario sin conexión."
        )

    # Obtener items de la OT (debe estar cargada con joinedload)
    items = work_order.work_order_items
    if not items:
        logger.warning(f"OT #{work_order.id} completada sin items de inventario")

    # ============================================================
    # 2. Procesar cada item
    # ============================================================
    errors: list[str] = []

    for item in items:
        try:
            _process_item(db, item, connection_id, current_user.id, work_order.id)
        except CompletionError as e:
            errors.append(str(e))

    if errors:
        raise CompletionError(
            "Errores al procesar inventario: " + "; ".join(errors)
        )

    # ============================================================
    # 3. Actualizar WorkOrder
    # ============================================================
    now = datetime.now(timezone.utc)
    # Detectar si es "No Realizada" (el endpoint mapea "no_realizada" → "incomplete")
    is_no_realizada = resolution_category in ('no_realizada', 'incomplete')
    work_order.status = WorkOrderStatus.failed if is_no_realizada else WorkOrderStatus.completed
    work_order.completed_at = now
    work_order.resolution_category = resolution_category
    work_order.resolution_notes = resolution_notes
    if photo_urls:
        work_order.photo_urls = photo_urls

    # ============================================================
    # 4. Timeline event - card clickeable con status visible
    # ============================================================
    final_status = WorkOrderStatus.failed if is_no_realizada else WorkOrderStatus.completed
    action_label = "No Realizada" if is_no_realizada else "Completada"
    item_count = len(items)
    
    timeline_meta = {
        "work_order_id": work_order.id,
        "status": final_status.value,            # ← frontend TicketDetailPage.jsx:265 usa .status
        "current_status": final_status.value,    # ← frontend TicketTimeline.jsx:116 usa .current_status
        "work_order_status": final_status.value, # ← legado
        "resolution_category": resolution_category,
        "item_count": item_count,
        "action_code": "no_realizada" if is_no_realizada else "realizada",
    }
    
    # Contenido descriptivo para que el operador entienda sin abrir la OT
    content_parts = [
        f"🛠️ OT #{work_order.id} — {action_label}",
    ]
    if item_count > 0:
        content_parts.append(f"📦 {item_count} material(es) procesado(s)")
    if resolution_notes:
        content_parts.append(f"📝 {resolution_notes[:200]}{'...' if len(resolution_notes) > 200 else ''}")
    
    timeline_event = TicketTimeline(
        ticket_id=work_order.ticket_id,
        author_id=current_user.id,
        event_type=TicketTimelineEventType.ot_event,
        content="\n".join(content_parts),
        meta_data=timeline_meta,
    )
    db.add(timeline_event)

    # ============================================================
    # 5. Connection Note (opcional)
    # ============================================================
    if connection_note and connection_note.strip():
        note = ConnectionNote(
            connection_id=connection_id,
            work_order_id=work_order.id,
            author_id=current_user.id,
            note=connection_note.strip(),
            is_pinned=False,
        )
        db.add(note)

    # ============================================================
    # 6. Actualizar connection_id en WorkOrderItems (histórico BULK)
    # ============================================================
    for item in items:
        item.connection_id = connection_id

    db.flush()
    return work_order


def _process_item(
    db: Session,
    item: WorkOrderItem,
    connection_id: int,
    user_id: int,
    work_order_id: int,
) -> None:
    """
    Procesa un item individual:
      - BULK: descuenta de StockBulk
      - SERIALIZED: actualiza SerialItem + crea ConnectionAsset
    """
    # Determinar tipo de producto
    from src.models.inventory import Product
    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise CompletionError(f"Producto ID {item.product_id} no encontrado en catálogo")

    if product.type == "BULK":
        _process_bulk_item(db, item, product, connection_id, user_id, work_order_id)
    elif product.type == "SERIALIZED":
        _process_serialized_item(db, item, product, connection_id, user_id, work_order_id)
    else:
        logger.warning(f"Tipo de producto desconocido: {product.type} para item {item.id}")


def _process_bulk_item(
    db: Session,
    item: WorkOrderItem,
    product,
    connection_id: int,
    user_id: int,
    work_order_id: int,
) -> None:
    """Descarga stock BULK del warehouse del técnico."""
    # Buscar el stock bulk (asumimos warehouse del técnico desde el item)
    # Nota: El warehouse_id se pasa al crear el item, pero si no está,
    # buscamos en el warehouse MOBILE del técnico.
    stock_entry = (
        db.query(StockBulk)
        .filter(
            StockBulk.product_id == item.product_id,
            StockBulk.warehouse_id == _get_technician_warehouse_id(db, user_id),
        )
        .first()
    )

    if not stock_entry or stock_entry.quantity < item.quantity:
        raise CompletionError(
            f"Stock insuficiente de {product.name}: "
            f"disponible {stock_entry.quantity if stock_entry else 0}, "
            f"requerido {item.quantity}"
        )

    # Descontar stock
    stock_entry.quantity -= item.quantity

    # Registrar movimiento
    movement = StockMovement(
        product_id=item.product_id,
        from_warehouse_id=stock_entry.warehouse_id,
        to_warehouse_id=None,
        quantity=item.quantity,
        movement_type=MovementType.CONSUMPTION,
        reference=f"OT #{work_order_id}",
        user_id=user_id,
        notes=f"Consumo: {product.name} x{item.quantity}",
    )
    db.add(movement)


def _process_serialized_item(
    db: Session,
    item: WorkOrderItem,
    product,
    connection_id: int,
    user_id: int,
    work_order_id: int,
) -> None:
    """Actualiza SerialItem y crea ConnectionAsset."""
    if not item.serial_number:
        raise CompletionError(
            f"Item serializado #{item.id} ({product.name}) no tiene número de serie"
        )

    # Buscar el serial item
    serial_item = (
        db.query(SerialItem)
        .filter(SerialItem.serial_number == item.serial_number)
        .first()
    )

    if not serial_item:
        raise CompletionError(
            f"Serial {item.serial_number} no encontrado en inventario"
        )

    if serial_item.status == SerialItemStatus.INSTALLED:
        raise CompletionError(
            f"Serial {item.serial_number} ya está instalado en otra conexión"
        )

    warehouse_id = serial_item.warehouse_id
    virtual_wh_id = _get_virtual_warehouse_id(db)

    # Actualizar SerialItem: se mueve al warehouse VIRTUAL (instalado en cliente)
    serial_item.status = SerialItemStatus.INSTALLED
    serial_item.warehouse_id = virtual_wh_id
    serial_item.connection_id = connection_id
    serial_item.ticket_related_id = item.work_order_id

    # Crear ConnectionAsset
    asset = ConnectionAsset(
        connection_id=connection_id,
        serial_item_id=serial_item.id,
        product_id=item.product_id,
        serial_number=item.serial_number,
        status=ConnectionAssetStatus.INSTALLED,
        installed_at=datetime.now(timezone.utc),
        installed_by_wo_id=work_order_id,
        notes=item.notes,
    )
    db.add(asset)

    # Registrar movimiento
    movement = StockMovement(
        product_id=item.product_id,
        from_warehouse_id=warehouse_id,
        to_warehouse_id=None,
        serial_item_id=serial_item.id,
        movement_type=MovementType.CONSUMPTION,
        reference=f"OT #{work_order_id}",
        user_id=user_id,
        notes=f"Instalado: {product.name} SN:{item.serial_number} en conexión #{connection_id}",
    )
    db.add(movement)


def _get_technician_warehouse_id(db: Session, user_id: int) -> Optional[int]:
    """
    Obtiene el warehouse MOBILE del técnico.
    Busca primero por team → vehicle → warehouse, luego por user_id directo.
    """
    from src.models.coordination import Team, TeamMember
    from src.models.fleet import Vehicle

    # Buscar por team
    team_member = (
        db.query(TeamMember)
        .filter(TeamMember.user_id == user_id)
        .first()
    )
    if team_member:
        team = db.query(Team).filter(Team.id == team_member.team_id).first()
        if team and team.vehicle_id:
            vehicle = db.query(Vehicle).filter(Vehicle.id == team.vehicle_id).first()
            if vehicle and vehicle.warehouse_id:
                return vehicle.warehouse_id

    # Fallback: warehouse con type=MOBILE asociado al user
    from src.models.inventory import Warehouse, WarehouseType
    warehouse = (
        db.query(Warehouse)
        .filter(
            Warehouse.user_id == user_id,
            Warehouse.type == WarehouseType.MOBILE,
        )
        .first()
    )
    if warehouse:
        return warehouse.id

    return None


def _get_virtual_warehouse_id(db: Session) -> int:
    """
    Obtiene el ID del warehouse VIRTUAL para equipos instalados en cliente.

    Este warehouse es un depósito virtual que representa equipos instalados
    en conexiones de clientes (no están físicamente en ningún depósito real).
    Se usa como warehouse_id en SerialItem cuando status=INSTALLED.
    """
    from src.models.inventory import Warehouse, WarehouseType
    warehouse = (
        db.query(Warehouse)
        .filter(Warehouse.type == WarehouseType.VIRTUAL)
        .first()
    )
    if not warehouse:
        raise CompletionError(
            "No se encontró un warehouse VIRTUAL. "
            "Debe existir un depósito de tipo VIRTUAL para registrar equipos instalados en cliente."
        )
    return warehouse.id
