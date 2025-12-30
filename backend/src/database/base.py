"""
Base declarativa y mixins para modelos SQLAlchemy 2.0
"""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


# Naming convention para constraints (facilita migraciones Alembic)
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """
    Base declarativa para todos los modelos del sistema.
    Usa SQLAlchemy 2.0 con type annotations.
    """
    metadata = metadata
    
    # Type checking helpers
    __allow_unmapped__ = False


class TimestampMixin:
    """
    Mixin para agregar timestamps automáticos a cualquier modelo.
    
    Campos:
        created_at: Timestamp de creación (UTC, automático)
        updated_at: Timestamp de última modificación (UTC, auto-actualizado)
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Fecha de creación del registro"
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Fecha de última actualización"
    )
