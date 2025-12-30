from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from src.models.ticket import Ticket, TicketEventType, TicketPriority, TicketStatus
from src.repositories.ticket_repository import TicketRepository
from src.schemas.ticket_schemas import TicketCreate, TicketEventCreate, TicketUpdate


class TicketService:
    def __init__(self, ticket_repository: TicketRepository, session: Session):
        self.ticket_repo = ticket_repository
        self.session = session

    def create_ticket(self, data: TicketCreate, creator_id: Optional[int]) -> Ticket:
        ticket = Ticket(
            title=data.title,
            description=data.description,
            category_id=data.category_id,
            priority=data.priority or TicketPriority.MEDIUM,
            status=TicketStatus.OPEN,
            customer_id=data.customer_id,
            creator_id=creator_id,
        )
        self.ticket_repo.create(ticket)
        self.ticket_repo.add_event(ticket.id, TicketEventType.CREATED, {"title": data.title}, creator_id)
        return self.ticket_repo.get_ticket_with_details(ticket.id)

    def add_comment(self, ticket_id: int, event: TicketEventCreate, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        comment_text = event.payload.get("comment") if event.payload else None
        self.ticket_repo.add_event(
            ticket_id,
            TicketEventType.COMMENT,
            {"comment": comment_text},
            user_id,
        )
        return self.ticket_repo.get_ticket_with_details(ticket_id)

    def change_status(self, ticket_id: int, new_status: TicketStatus, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        old_status = ticket.status
        ticket.status = new_status
        self.ticket_repo.update(ticket)
        self.ticket_repo.add_event(
            ticket_id,
            TicketEventType.STATUS_CHANGE,
            {"old": old_status, "new": new_status},
            user_id,
        )
        return self.ticket_repo.get_ticket_with_details(ticket_id)

    def update_ticket(self, ticket_id: int, data: TicketUpdate, user_id: Optional[int]) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")

        if data.priority is not None:
            ticket.priority = data.priority
        if data.assigned_to_id is not None:
            ticket.assigned_id = data.assigned_to_id
        if data.status is not None:
            return self.change_status(ticket_id, data.status, user_id)

        self.ticket_repo.update(ticket)
        return self.ticket_repo.get_ticket_with_details(ticket_id)
