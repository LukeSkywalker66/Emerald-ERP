from __future__ import annotations

from enum import StrEnum
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin
from src.models.user import User


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketEventType(StrEnum):
    CREATED = "CREATED"
    COMMENT = "COMMENT"
    STATUS_CHANGE = "STATUS_CHANGE"


class TicketCategory(Base, TimestampMixin):
    __tablename__ = "ticket_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tickets: Mapped[list[Ticket]] = relationship("Ticket", back_populates="category", lazy="select")


class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"),
        default=TicketStatus.OPEN,
        nullable=False,
        index=True,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum"),
        default=TicketPriority.MEDIUM,
        nullable=False,
        index=True,
    )
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ticket_categories.id"), nullable=True, index=True)
    creator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assigned_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    category: Mapped[Optional[TicketCategory]] = relationship("TicketCategory", back_populates="tickets", lazy="joined")
    creator: Mapped[Optional[User]] = relationship("User", foreign_keys=[creator_id], lazy="joined")
    assignee: Mapped[Optional[User]] = relationship("User", foreign_keys=[assigned_id], lazy="joined")
    events: Mapped[list[TicketEvent]] = relationship(
        "TicketEvent",
        back_populates="ticket",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="TicketEvent.created_at.asc()",
    )


class TicketEvent(Base, TimestampMixin):
    __tablename__ = "ticket_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False, index=True)
    event_type: Mapped[TicketEventType] = mapped_column(
        Enum(TicketEventType, name="ticket_event_type_enum"),
        nullable=False,
        index=True,
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    ticket: Mapped[Ticket] = relationship("Ticket", back_populates="events", lazy="joined")
    user: Mapped[Optional[User]] = relationship("User", lazy="joined")
