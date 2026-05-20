"""Model for WorkOrderType configuration (DB-driven labels)."""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class WorkOrderTypeConfig(Base):
    """Configurable work order type with DB-driven labels, colors and icons.

    This replaces hardcoded dictionaries across the frontend so that labels
    can be changed without redeploying code.
    """

    __tablename__ = "work_order_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Display label (Spanish)"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(
        String(50), default="bg-zinc-600",
        comment="Tailwind CSS class for card background"
    )
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="Lucide icon name (e.g. Wrench, Package)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<WorkOrderTypeConfig(id={self.id}, code='{self.code}', name='{self.name}')>"
