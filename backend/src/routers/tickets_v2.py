"""Router para Tickets v2.0"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from src.database import get_db
from src.models.tickets import (
    Ticket as TicketV2,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrder,
    WorkOrderStatus,
)
from src.schemas.tickets import (
    TicketCreate,
    TicketDetailResponse,
    TicketResponse,
    TimelineEventResponse,
    WorkOrderCreate,
    WorkOrderResponse,
)
from src.models import TicketPriority, TicketStatus

router = APIRouter()


def get_user_id(request: Request) -> int:
    return getattr(request.state, "user_id", 1)


def _safe_name(user) -> Optional[str]:
    if user is None:
        return None
    return user.full_name or user.username


def _ticket_to_response(ticket: TicketV2) -> TicketResponse:
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
def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TicketV2)
        .options(joinedload(TicketV2.creator), joinedload(TicketV2.assigned_to))
        .order_by(TicketV2.created_at.desc())
    )
    if status:
        stmt = stmt.where(TicketV2.status == status)
    if priority:
        stmt = stmt.where(TicketV2.priority == priority)

    tickets = db.execute(stmt.limit(limit).offset(offset)).scalars().all()
    return [_ticket_to_response(t) for t in tickets]


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    ticket = TicketV2(
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


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(TicketV2)
        .where(TicketV2.id == ticket_id)
        .options(
            joinedload(TicketV2.creator),
            joinedload(TicketV2.assigned_to),
            selectinload(TicketV2.timeline),
            selectinload(TicketV2.work_orders).joinedload(WorkOrder.technician),
        )
    )
    ticket = db.execute(stmt).scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    timeline_events = sorted(ticket.timeline, key=lambda ev: ev.created_at)
    timeline = [_timeline_to_response(ev) for ev in timeline_events]
    work_orders = [_workorder_to_response(wo) for wo in ticket.work_orders]

    return TicketDetailResponse(
        **_ticket_to_response(ticket).model_dump(),
        timeline=timeline,
        work_orders=work_orders,
    )


@router.post("/{ticket_id}/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    ticket_id: int,
    payload: WorkOrderCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id),
):
    ticket = db.get(TicketV2, ticket_id)
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
