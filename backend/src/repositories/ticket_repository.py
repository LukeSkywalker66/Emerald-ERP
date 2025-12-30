from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from src.models.ticket import Ticket, TicketEvent, TicketEventType
from src.repositories.base import BaseRepository


class TicketRepository(BaseRepository[Ticket]):
    def __init__(self, db: Session):
        super().__init__(Ticket, db)

    def get_ticket_with_details(self, ticket_id: int) -> Optional[Ticket]:
        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                joinedload(Ticket.category),
                joinedload(Ticket.creator),
                joinedload(Ticket.assignee),
                joinedload(Ticket.events).joinedload(TicketEvent.user),
            )
        )
        result = self.db.execute(stmt)
        return result.scalars().first()

    def add_event(
        self,
        ticket_id: int,
        event_type: TicketEventType,
        payload: dict,
        user_id: Optional[int] = None,
    ) -> TicketEvent:
        event = TicketEvent(
            ticket_id=ticket_id,
            event_type=event_type,
            payload=payload,
            user_id=user_id,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event
