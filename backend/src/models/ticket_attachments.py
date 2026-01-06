"""
Modelo de Adjuntos en Tickets.

Almacena metadatos de archivos subidos asociados a un ticket.
Los archivos se guardan en disco bajo backend/media/tickets/{ticket_id}/
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin


class TicketAttachment(Base, TimestampMixin):
    """
    Modelo de Adjuntos en Tickets.
    
    Almacena metadatos de archivos subidos asociados a un ticket.
    Los archivos se guardan en disco bajo backend/media/tickets/{ticket_id}/
    """
    __tablename__ = "ticket_attachments"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del adjunto"
    )

    # Foreign Keys
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets_v2.id", name="fk_ticket_attachments_ticket_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a ticket"
    )
    uploader_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", name="fk_ticket_attachments_uploader_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario que subió el archivo"
    )

    # Datos del archivo
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Nombre original del archivo"
    )
    filepath: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        unique=True,
        index=True,
        comment="Ruta relativa: tickets/{ticket_id}/{uuid}_{filename}"
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="application/octet-stream",
        comment="MIME type del archivo (ej: image/jpeg, application/pdf)"
    )
    size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Tamaño en bytes"
    )

    # Relationships
    ticket: Mapped["Ticket"] = relationship(
        "Ticket",
        back_populates="attachments",
        lazy="joined",
        foreign_keys=[ticket_id]
    )
    uploader: Mapped[Optional["User"]] = relationship(
        "User",
        lazy="joined",
        foreign_keys=[uploader_id]
    )

    def __repr__(self) -> str:
        return f"<TicketAttachment(id={self.id}, filename={self.filename}, ticket_id={self.ticket_id})>"
