"""
Modelo para registrar intentos de contacto con clientes durante coordinación.

Permite trackear llamadas fallidas, notas y resultados de coordinación.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from src.database import Base


class ContactAttemptResult(str, enum.Enum):
    """Resultado del intento de contacto."""
    no_answer = "no_answer"              # No contesta
    busy = "busy"                        # Ocupado
    wrong_number = "wrong_number"        # Número equivocado
    voicemail = "voicemail"              # Buzón de voz
    successful = "successful"            # Contacto exitoso
    rescheduled = "rescheduled"          # Cliente pidió reprogramar
    refused = "refused"                  # Cliente rechazó la visita


class ContactAttempt(Base):
    """
    Registro de intentos de contacto telefónico con clientes.
    
    Cada intento queda logueado con timestamp, resultado y notas opcionales.
    Permite auditoría completa del proceso de coordinación.
    """
    __tablename__ = "contact_attempts"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del intento de contacto"
    )

    work_order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="OT asociada al intento de contacto"
    )

    attempted_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Usuario (coordinador) que realizó el intento"
    )

    result: Mapped[ContactAttemptResult] = mapped_column(
        SQLEnum(ContactAttemptResult, name="contact_attempt_result_enum", create_type=False),
        nullable=False,
        index=True,
        comment="Resultado del intento de contacto"
    )

    phone_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Número al que se intentó llamar (snapshot)"
    )

    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas adicionales del coordinador (ej: 'Pide llamar después de las 14hs')"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
        comment="Timestamp del intento"
    )

    # Relationships
    work_order: Mapped["WorkOrder"] = relationship(
        "WorkOrder",
        back_populates="contact_attempts",
        lazy="selectin"
    )

    coordinator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[attempted_by],
        lazy="selectin"
    )

    def __repr__(self):
        return f"<ContactAttempt(id={self.id}, wo={self.work_order_id}, result={self.result.value})>"
