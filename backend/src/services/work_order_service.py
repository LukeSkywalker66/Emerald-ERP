"""Servicio de dominio para creación de órdenes de trabajo.

Centraliza la semántica Ticket -> OT para evitar divergencias entre routers.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from src.models import TicketPriority
from src.models.tickets import (
    Ticket,
    TicketTimeline,
    TicketTimelineEventType,
    WorkOrder,
    WorkOrderStatus,
    WorkOrderType,
)
from src.services.work_order_snapshot_service import build_connection_snapshot


def _normalize_priority(priority: Any, ticket: Ticket) -> TicketPriority:
    if isinstance(priority, TicketPriority):
        return priority

    if isinstance(priority, str):
        try:
            return TicketPriority(priority)
        except ValueError:
            pass

    if isinstance(ticket.priority, TicketPriority):
        return ticket.priority

    return TicketPriority.medium


def _resolve_operational_instruction(
    operational_instruction: Optional[str],
    description: Optional[str],
    notes: Optional[str],
) -> str:
    candidates = [operational_instruction, description, notes]
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    raise ValueError("La instruccion operativa de la OT es obligatoria")


def create_work_order_for_ticket(
    db: Session,
    *,
    ticket: Ticket,
    author_id: int,
    ot_type: WorkOrderType,
    priority: Optional[Any] = None,
    operational_instruction: Optional[str] = None,
    description: Optional[str] = None,
    notes: Optional[str] = None,
    extra_custom_data: Optional[dict] = None,
    timeline_content: Optional[str] = None,
    timeline_meta_extra: Optional[dict] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> WorkOrder:
    """Crea una OT con contrato semantico estricto y evento de timeline asociado.

    Reglas de dominio:
    - Ticket.description = contexto historico del incidente.
    - WorkOrder.notes = instruccion operativa puntual para cuadrilla.
    """
    resolved_priority = _normalize_priority(priority, ticket)
    instruction = _resolve_operational_instruction(
        operational_instruction=operational_instruction,
        description=description,
        notes=notes,
    )

    ticket_custom_data = dict(getattr(ticket, "custom_data", {}) or {})
    connection_snapshot = build_connection_snapshot(db, ticket.connection_id)

    custom_data = {
        **ticket_custom_data,
        "priority": resolved_priority.value,
        "client_id": getattr(ticket, "client_id", None),
        "connection_id": ticket.connection_id,
        "address": getattr(ticket, "address", None) or getattr(ticket, "availability_note", None),
        "connection": connection_snapshot,
    }
    if extra_custom_data:
        custom_data.update(extra_custom_data)

    work_order = WorkOrder(
        ticket_id=ticket.id,
        ot_type=ot_type,
        status=WorkOrderStatus.pending_planning,
        technician_id=None,
        priority=resolved_priority,
        notes=instruction,
        custom_data=custom_data,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(work_order)
    db.flush()

    timeline_meta = {
        "work_order_id": work_order.id,
        "ot_type": ot_type.value,
        "operational_instruction": instruction,
        "priority": resolved_priority.value,
        "status": work_order.status.value,
    }
    if timeline_meta_extra:
        timeline_meta.update(timeline_meta_extra)

    db.add(
        TicketTimeline(
            ticket_id=ticket.id,
            author_id=author_id,
            event_type=TicketTimelineEventType.ot_event,
            content=timeline_content or f"Orden de trabajo generada ({ot_type.value})",
            meta_data=timeline_meta,
        )
    )

    return work_order
