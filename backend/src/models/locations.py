"""
Models for locations (cities and neighborhoods).
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    zone_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    neighborhoods: Mapped[list["Neighborhood"]] = relationship(
        "Neighborhood",
        back_populates="city",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("name", name="uq_cities_name"),
        Index("ix_cities_name", "name"),
    )


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=False)

    city: Mapped[City] = relationship("City", back_populates="neighborhoods", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("city_id", "name", name="uq_neighborhoods_city_id_name"),
        Index("ix_neighborhoods_name", "name"),
        Index("ix_neighborhoods_city_id", "city_id"),
    )
