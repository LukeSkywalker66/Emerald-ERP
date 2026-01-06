"""Router para WorkOrders - Endpoints de ejecución para técnicos."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from src.database import get_db
from src.models.tickets import WorkOrder, WorkOrderItem, Ticket, TicketTimeline, TicketTimelineEventType
from src.schemas.tickets import (
    WorkOrderDetailResponse,
    WorkOrderUpdate,
    WorkOrderItemCreate,
    WorkOrderItemResponse,
)

router = APIRouter(prefix="/v2/work-orders", tags=["work-orders"])


def get_user_id(request: Request) -> int:
    """Extract user_id from request state (set by middleware)."""
    return getattr(request.state, "user_id", 2)  # Fallback to admin user


@router.get("/{work_order_id}", response_model=WorkOrderDetailResponse)
def get_work_order_detail(
    work_order_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Obtener detalles completos de una OT (para técnicos)."""
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.technician),
            joinedload(WorkOrder.ticket),
            joinedload(WorkOrder.work_order_items),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Construir ticket_info si existe
    ticket_info = None
    if wo.ticket:
        ticket_info = {
            "id": wo.ticket.id,
            "subject": wo.ticket.subject,
            "connection_id": wo.ticket.connection_id,
            "priority": wo.ticket.priority.value if wo.ticket.priority else None,
        }
    
    return WorkOrderDetailResponse(
        id=wo.id,
        ticket_id=wo.ticket_id,
        ot_type=wo.ot_type,
        status=wo.status,
        technician_id=wo.technician_id,
        technician_name=wo.technician.full_name if wo.technician else None,
        scheduled_at=wo.scheduled_at,
        started_at=wo.started_at,
        completed_at=wo.completed_at,
        resolution_type=wo.resolution_type,
        resolution_notes=wo.resolution_notes,
        custom_data=wo.custom_data or {},
        notes=wo.notes,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
        items=[
            WorkOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                serial_number=item.serial_number,
                notes=item.notes,
                created_at=item.created_at
            ) for item in wo.work_order_items
        ],
        ticket_info=ticket_info,
    )


@router.patch("/{work_order_id}", response_model=WorkOrderDetailResponse)
def update_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Actualizar estado de OT (usado por técnicos durante ejecución)."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    # Guardar estado anterior para logging
    old_status = wo.status
    
    # Actualizar campos
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(wo, key, value)
    
    # Crear evento de timeline si cambia estado
    if payload.status and payload.status != old_status:
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id}: Estado actualizado de {old_status.value} a {payload.status.value}",
            meta_data={"work_order_id": wo.id, "old_status": old_status.value, "new_status": payload.status.value},
        )
        db.add(timeline_event)
    
    # Si se completa la OT, registrar en timeline
    if payload.completed_at and not wo.completed_at:
        resolution_label = payload.resolution_type.value if payload.resolution_type else "sin especificar"
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id} finalizada - Resultado: {resolution_label}",
            meta_data={
                "work_order_id": wo.id,
                "resolution_type": payload.resolution_type.value if payload.resolution_type else None,
                "custom_data": payload.custom_data or {}
            },
        )
        db.add(timeline_event)
    
    db.commit()
    db.refresh(wo)
    
    return get_work_order_detail(work_order_id, db, user_id)


@router.post("/{work_order_id}/items", response_model=WorkOrderItemResponse, status_code=201)
def add_work_order_item(
    work_order_id: int,
    payload: WorkOrderItemCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Agregar material consumido a una OT."""
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="WorkOrder not found")
    
    item = WorkOrderItem(
        work_order_id=work_order_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        serial_number=payload.serial_number,
        notes=payload.notes,
    )
    db.add(item)
    
    # Evento de timeline
    serial_info = f" (SN: {payload.serial_number})" if payload.serial_number else ""
    timeline_event = TicketTimeline(
        ticket_id=wo.ticket_id,
        author_id=user_id,
        event_type=TicketTimelineEventType.ot_event,
        content=f"Material agregado a OT #{wo.id}: Producto {payload.product_id} x{payload.quantity}{serial_info}",
        meta_data={"work_order_id": wo.id, "product_id": payload.product_id, "quantity": payload.quantity},
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(item)
    
    return WorkOrderItemResponse(
        id=item.id,
        product_id=item.product_id,
        quantity=item.quantity,
        serial_number=item.serial_number,
        notes=item.notes,
        created_at=item.created_at
    )


@router.delete("/{work_order_id}/items/{item_id}", status_code=204)
def remove_work_order_item(
    work_order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Eliminar un item de material de una OT."""
    item = (
        db.query(WorkOrderItem)
        .filter(
            WorkOrderItem.id == item_id,
            WorkOrderItem.work_order_id == work_order_id,
        )
        .first()
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    db.commit()
    
    return None
