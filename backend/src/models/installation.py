"""Installation-related models."""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class InstallationType(Base):
    """Tipo de instalación escalable (Fibra, Inalámbrico, Híbrido, etc.)."""

    __tablename__ = "installation_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<InstallationType(id={self.id}, code='{self.code}', name='{self.name}')>"


class TvAccount(Base):
    """Cuenta de TV (usuario PPPoE de IPTV) reutilizable.

    `connection_id` NULL indica que la cuenta está libre; asignada implica en uso.
    """

    __tablename__ = "tv_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(120), nullable=False)
    connection_id: Mapped[int | None] = mapped_column(
        ForeignKey("connections.connection_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Conexión a la que está asignado (NULL = libre)",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="available",
        index=True,
        comment="available | assigned",
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<TvAccount(id={self.id}, username='{self.username}', status='{self.status}')>"
