"""Router para Tickets v2.0"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from src.database import get_db
from src.models import (
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrder,
    WorkOrderStatus,
    TicketPriority,
    TicketStatus,
)
from src.schemas.tickets import (
    TicketCreate,
    TicketUpdate,
    TimelineEventCreate,
    TicketDetailResponse,
    TicketResponse,
    TimelineEventResponse,
    WorkOrderCreate,
    WorkOrderResponse,
    ConnectionDetailsResponse,
)

router = APIRouter()

# Traducciones para mensajes en español
STATUS_LABELS = {
    "open": "Abierto",
    "pending": "Pendiente",
    "resolved": "Resuelto",
    "closed": "Cerrado",
}

PRIORITY_LABELS = {
    "low": "Baja",
    "medium": "Media",
    "high": "Alta",
    "critical": "Crítica",
}


def get_user_id(request: Request) -> int:
    return getattr(request.state, "user_id", 2)  # User admin@emerald.com


def _safe_name(user) -> Optional[str]:
    if user is None:
        return None
    return user.full_name or user.username


def _ticket_to_response(ticket: Ticket) -> TicketResponse:
    return TicketResponse(
        id=ticket.id,
        subject=ticket.subject,
        status=ticket.status,
        priority=ticket.priority,
        connection_id=ticket.connection_id,
        created_at=ticket.created_at,
        creator_name=_safe_name(ticket.creator),
        assigned_to_name=_safe_name(ticket.assigned_to),
    )


def _timeline_to_response(event: TicketTimeline) -> TimelineEventResponse:
    return TimelineEventResponse(
        id=event.id,
        event_type=event.event_type,
        content=event.content,
        created_at=event.created_at,
        author_name=_safe_name(event.author),
    )


def _workorder_to_response(wo: WorkOrder) -> WorkOrderResponse:
    return WorkOrderResponse(
        id=wo.id,
        status=wo.status,
        technician_name=_safe_name(wo.technician),
        scheduled_at=wo.scheduled_at,
    )


@router.get("/", response_model=List[TicketResponse])
@router.get("", response_model=List[TicketResponse])
def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Ticket)
        .options(joinedload(Ticket.creator), joinedload(Ticket.assigned_to))
        .order_by(Ticket.created_at.desc())
    )
    if status:
        stmt = stmt.where(Ticket.status == status)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)

    tickets = db.execute(stmt.limit(limit).offset(offset)).scalars().all()
    return [_ticket_to_response(t) for t in tickets]


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    ticket = Ticket(
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        connection_id=payload.connection_id,
        creator_id=user_id,
    )
    db.add(ticket)
    db.flush()

    first_note = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.NOTE,
        content=payload.description or "Ticket creado",
        meta_data=None,
    )
    db.add(first_note)

    db.commit()
    db.refresh(ticket)
    db.refresh(ticket, attribute_names=["creator", "assigned_to"])
    return _ticket_to_response(ticket)


@router.get("/{ticket_id}/", response_model=TicketDetailResponse)
@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.creator),
            joinedload(Ticket.assigned_to),
            selectinload(Ticket.timeline),
            selectinload(Ticket.work_orders).joinedload(WorkOrder.technician),
        )
    )
    ticket = db.execute(stmt).scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    timeline_events = sorted(ticket.timeline, key=lambda ev: ev.created_at)
    timeline = [_timeline_to_response(ev) for ev in timeline_events]
    work_orders = [_workorder_to_response(wo) for wo in ticket.work_orders]

    # Enriquecer con datos de la conexión (si existe)
    connection_details = None
    if ticket.connection_id:
        conn_data = db.execute(
            text("""
                SELECT 
                    c.connection_id,
                    c.pppoe_username,
                    COALESCE(c.direccion, cl.address) as address,
                    cl.name as client_name,
                    cl.doc_number as client_dni,
                    n.name as node_name,
                    n.ip_address as node_ip,
                    p.name as plan_name,
                    p.speed as plan_speed,
                    NULL::text as phone
                FROM connections c
                LEFT JOIN clientes cl ON c.customer_id = cl.id
                LEFT JOIN nodes n ON c.node_id = n.node_id
                LEFT JOIN plans p ON c.plan_id = p.plan_id
                WHERE c.connection_id = :conn_id
                LIMIT 1
            """),
            {"conn_id": ticket.connection_id}
        ).first()
        
        if conn_data:
            connection_details = ConnectionDetailsResponse(
                connection_id=conn_data[0],
                pppoe_username=conn_data[1],
                address=conn_data[2],
                client_name=conn_data[3],
                client_dni=conn_data[4],
                node_name=conn_data[5],
                node_ip=conn_data[6],
                plan_name=conn_data[7],
                plan_speed=conn_data[8],
                phone=conn_data[9],
            )

    return TicketDetailResponse(
        **_ticket_to_response(ticket).model_dump(),
        connection_details=connection_details,
        timeline=timeline,
        work_orders=work_orders,
    )


@router.post("/{ticket_id}/work-orders/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{ticket_id}/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    ticket_id: int,
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    work_order = WorkOrder(
        ticket_id=ticket.id,
        ot_type=payload.ot_type,
        status=WorkOrderStatus.PENDING_PLANNING,
        notes=payload.notes,
    )
    db.add(work_order)
    db.flush()

    timeline_event = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=TicketTimelineEventType.OT_EVENT,
        content=f"Orden de trabajo generada ({payload.ot_type.value})",
        meta_data={
            "work_order_id": work_order.id,
            "ot_type": payload.ot_type.value,
        },
    )
    db.add(timeline_event)

    db.commit()
    db.refresh(work_order)
    db.refresh(work_order, attribute_names=["technician"])
    return _workorder_to_response(work_order)


@router.patch("/{ticket_id}/", response_model=TicketResponse)
@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Actualización parcial de un ticket."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Actualizar solo los campos que vienen en el payload
    changes = []
    if payload.priority is not None and payload.priority != ticket.priority:
        old_label = PRIORITY_LABELS.get(ticket.priority.value, ticket.priority.value)
        new_label = PRIORITY_LABELS.get(payload.priority.value, payload.priority.value)
        ticket.priority = payload.priority
        changes.append(f"Prioridad cambiada de {old_label} a {new_label}")
    
    if payload.status is not None and payload.status != ticket.status:
        old_label = STATUS_LABELS.get(ticket.status.value, ticket.status.value)
        new_label = STATUS_LABELS.get(payload.status.value, payload.status.value)
        ticket.status = payload.status
        changes.append(f"Estado cambiado de {old_label} a {new_label}")
    
    if payload.assigned_to_id is not None:
        old_user = ticket.assigned_to
        ticket.assigned_to_id = payload.assigned_to_id
        db.flush()
        db.refresh(ticket, attribute_names=["assigned_to"])
        new_name = _safe_name(ticket.assigned_to) if ticket.assigned_to else "Sin asignar"
        old_name = _safe_name(old_user) if old_user else "Sin asignar"
        changes.append(f"Asignado cambiado de {old_name} a {new_name}")

    # Crear evento en el timeline si hubo cambios
    if changes:
        timeline_event = TicketTimeline(
            ticket_id=ticket.id,
            author_id=user_id,
            event_type=TicketTimelineEventType.STATUS_CHANGE,
            content=". ".join(changes),
            meta_data=None,
        )
        db.add(timeline_event)

    db.commit()
    db.refresh(ticket, attribute_names=["creator", "assigned_to"])
    return _ticket_to_response(ticket)


@router.post("/{ticket_id}/timeline/", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{ticket_id}/timeline", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
def create_timeline_event(
    ticket_id: int,
    payload: TimelineEventCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    """Crear un evento en la cronología del ticket (nota, etc)."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    event = TicketTimeline(
        ticket_id=ticket.id,
        author_id=user_id,
        event_type=payload.event_type,
        content=payload.content,
        meta_data=None,
    )
    db.add(event)
    db.commit()
    db.refresh(event, attribute_names=["author"])
    return _timeline_to_response(event)

