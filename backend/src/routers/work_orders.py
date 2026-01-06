"""Router para WorkOrders - Endpoints de listado y ejecución para técnicos."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from src.database import get_db
from src.models.tickets import (
    WorkOrder,
    WorkOrderItem,
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrderStatus,
    WorkOrderType,
)
from src.models.user import User
from src.schemas.tickets import (
    WorkOrderCreate,
    WorkOrderDetailResponse,
    WorkOrderUpdate,
    WorkOrderItemCreate,
    WorkOrderItemResponse,
    WorkOrderListResponse,
)

router = APIRouter(prefix="/v2/work-orders", tags=["work-orders"])


def get_user_id(request: Request) -> int:
    """Extract user_id from request state (set by middleware)."""
    return getattr(request.state, "user_id", 2)  # Fallback to admin user


def get_current_user(request: Request, db: Session = Depends(get_db), user_id: int = Depends(get_user_id)) -> User:
    """Obtiene el usuario actual con su rol para aplicar filtros automáticos."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("", response_model=WorkOrderDetailResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear una nueva OT heredando datos del ticket asociado."""
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Crear la OT con datos heredados del ticket
    wo = WorkOrder(
        ticket_id=ticket.id,
        ot_type=payload.ot_type,
        status=WorkOrderStatus.pending_planning,
        technician_id=None,  # Sin asignar inicialmente
        notes=payload.description or payload.notes,
        custom_data={
            **(ticket.custom_data or {}),
            "priority": payload.priority or "medium",
            "client_id": getattr(ticket, "client_id", None),
            "connection_id": ticket.connection_id,
            "address": getattr(ticket, "address", None) or getattr(ticket, "availability_note", None),
        },
    )
    db.add(wo)
    db.flush()

    # Registrar evento en timeline del ticket
    db.add(
        TicketTimeline(
            ticket_id=ticket.id,
            author_id=current_user.id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"Orden de trabajo generada ({payload.ot_type.value})",
            meta_data={"work_order_id": wo.id, "ot_type": payload.ot_type.value},
        )
    )
    db.commit()
    db.refresh(wo)
    
    return get_work_order_detail(wo.id, db, current_user)


@router.get("", response_model=dict)
def list_work_orders(
    status: Optional[WorkOrderStatus] = Query(None, description="Estado de la OT"),
    date_range: Optional[str] = Query(None, description="Rango de fechas YYYY-MM-DD,YYYY-MM-DD"),
    mobile_unit_id: Optional[int] = Query(None, description="Técnico/Móvil asignado"),
    ot_type: Optional[str] = Query(None, description="Tipo de OT"),
    search: Optional[str] = Query(None, description="Buscar por ID o asunto"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listado de OTs con filtros automáticos según rol y filtros opcionales."""

    # Query base sin opciones pesadas (se aplican solo en el query de datos)
    base_query = db.query(WorkOrder)

    # Normalizamos el rol para evitar accesos repetidos a relaciones
    role_name = current_user.role.name if current_user.role else None

    # Filtro automático por rol
    if role_name == "technician":
        base_query = base_query.filter(WorkOrder.technician_id == current_user.id)
    # Admin/Coordinator u otros roles ven todas

    # Filtros opcionales
    if status:
        base_query = base_query.filter(WorkOrder.status == status)

    if ot_type:
        try:
            ot_enum = WorkOrderType(ot_type)
            base_query = base_query.filter(WorkOrder.ot_type == ot_enum)
        except ValueError:
            pass

    if date_range:
        try:
            start_str, end_str = (date_range.split(",") + [None, None])[:2]
            if start_str:
                start_date = datetime.fromisoformat(start_str)
                base_query = base_query.filter(WorkOrder.scheduled_at >= start_date)
            if end_str:
                end_date = datetime.fromisoformat(end_str) + timedelta(days=1)
                base_query = base_query.filter(WorkOrder.scheduled_at < end_date)
        except ValueError:
            # Si el formato no es válido, ignoramos el filtro
            pass

    if mobile_unit_id and role_name != "technician":
        base_query = base_query.filter(WorkOrder.technician_id == mobile_unit_id)

    if search:
        pattern = f"%{search}%"
        base_query = (
            base_query.join(Ticket, isouter=True)
            .filter(
                or_(
                    cast(WorkOrder.id, String).ilike(pattern),
                    Ticket.subject.ilike(pattern),
                )
            )
            .distinct()
        )

    # Conteo ligero (solo IDs, sin joins extra de loaders)
    total = base_query.with_entities(WorkOrder.id).count()

    # Query de datos con loaders optimizados
    data_query = base_query.options(
        selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
        selectinload(WorkOrder.technician),
    )

    work_orders = (
        data_query.order_by(WorkOrder.scheduled_at.asc().nulls_last(), WorkOrder.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items = [_wo_to_list_response(wo).model_dump() for wo in work_orders]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "pages": (total + limit - 1) // limit if limit else 0,
    }


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
    
    # Construir ticket_info si existe, incluyendo cliente y dirección
    ticket_info = None
    if wo.ticket:
        ticket_info = {
            "id": wo.ticket.id,
            "subject": wo.ticket.subject,
            "connection_id": wo.ticket.connection_id,
            "priority": wo.ticket.priority.value if wo.ticket.priority else None,
            "client_name": getattr(wo.ticket, "client_name", None) or (wo.ticket.creator.full_name if wo.ticket.creator else None),
            "address": getattr(wo.ticket, "address", None) or getattr(wo.ticket, "availability_note", None),
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
    
    # Si se completa la OT, registrar en timeline con detalles de resolución
    if payload.completed_at and not wo.completed_at:
        resolution_notes = payload.resolution_notes or (payload.resolution_type.value if payload.resolution_type else "sin especificar")
        timeline_event = TicketTimeline(
            ticket_id=wo.ticket_id,
            author_id=user_id,
            event_type=TicketTimelineEventType.ot_event,
            content=f"OT #{wo.id} Finalizada: {resolution_notes}",
            meta_data={
                "work_order_id": wo.id,
                "resolution_type": payload.resolution_type.value if payload.resolution_type else None,
                "resolution_notes": resolution_notes,
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


def _wo_to_list_response(wo: WorkOrder) -> WorkOrderListResponse:
    """Construye la respuesta resumida para listado."""
    ticket_title = wo.ticket.subject if wo.ticket else "Sin ticket"
    client_name = None
    if wo.ticket and wo.ticket.creator:
        client_name = wo.ticket.creator.full_name or wo.ticket.creator.email

    # TODO: incluir dirección real cuando esté disponible (conexiones/ISPCube)
    address = getattr(wo.ticket, "availability_note", None) or "-"

    return WorkOrderListResponse(
        id=wo.id,
        ticket_id=wo.ticket_id,
        ticket_title=ticket_title,
        ot_type=wo.ot_type.value if wo.ot_type else "unknown",
        status=wo.status.value if wo.status else WorkOrderStatus.pending_planning.value,
        client_name=client_name,
        address=address,
        technician_name=wo.technician.full_name if wo.technician else None,
        scheduled_at=wo.scheduled_at,
        started_at=wo.started_at,
        completed_at=wo.completed_at,
        created_at=wo.created_at,
    )
