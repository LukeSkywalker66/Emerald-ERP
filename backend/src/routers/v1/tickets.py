from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.security import get_current_user
from src.database import get_db
from src.models.ticket import TicketEventType, TicketStatus
from src.repositories.ticket_repository import TicketRepository
from src.schemas.ticket_schemas import (
    TicketCreate,
    TicketDetail,
    TicketEventCreate,
    TicketOut,
    TicketUpdate,
)
from src.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["Tickets"])

PERM_TICKETS_READ = "tickets:read"
PERM_TICKETS_WRITE = "tickets:write"


def get_ticket_service(db: Session = Depends(get_db)) -> TicketService:
    repo = TicketRepository(db)
    return TicketService(repo, db)


def _ensure_can_read(user):
    if user.is_superuser:
        return True
    perms = (user.role.permissions if user.role and user.role.permissions else [])
    if isinstance(perms, dict):
        perms = perms.get("permissions", []) or []
    if PERM_TICKETS_READ in perms or "*" in perms:
        return True
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def _ensure_can_write(user):
    if user.is_superuser:
        return True
    perms = (user.role.permissions if user.role and user.role.permissions else [])
    if isinstance(perms, dict):
        perms = perms.get("permissions", []) or []
    if PERM_TICKETS_WRITE in perms or "*" in perms:
        return True
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


@router.post("/", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    ticket = service.create_ticket(payload, creator_id=current_user.id)
    return ticket


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket_detail(
    ticket_id: int,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_read(current_user)
    ticket = service.ticket_repo.get_ticket_with_details(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


@router.post("/{ticket_id}/comment", response_model=TicketDetail)
def add_comment(
    ticket_id: int,
    payload: TicketEventCreate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    if payload.event_type != TicketEventType.COMMENT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event_type must be COMMENT")
    ticket = service.add_comment(ticket_id, payload, current_user.id)
    return ticket


@router.patch("/{ticket_id}/status", response_model=TicketDetail)
def change_status(
    ticket_id: int,
    data: TicketUpdate,
    current_user=Depends(get_current_user),
    service: TicketService = Depends(get_ticket_service),
):
    _ensure_can_write(current_user)
    if data.status is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status is required")
    ticket = service.change_status(ticket_id, data.status, current_user.id)
    return ticket
