"""
Fleet Management Models - Gestión de vehículos operativos.

Separación clara: Vehicle es un ACTIVO FÍSICO, Warehouse es un CONTENEDOR DE INVENTARIO.
"""
from __future__ import annotations
from datetime import datetime, date
from typing import Optional, TYPE_CHECKING
from enum import Enum as PyEnum

from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, CheckConstraint, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.models.inventory import Warehouse
    from src.models.coordination import Team
    from src.models.user import User


class VehicleStatus(str, PyEnum):
    """Estados operativos del vehículo."""
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"
    DONATED = "DONATED"


class Vehicle(Base):
    """
    Modelo de Vehículo operativo.
    
    Un vehículo es un activo físico que:
    - Es conducido por una cuadrilla (Team)
    - Tiene un almacén de inventario asociado (Warehouse)
    - Contiene datos de identificación real (patente, marca, modelo)
    """
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del vehículo"
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
        comment="Nombre descriptivo (ej: 'Móvil 01 - Zona Norte')"
    )

    license_plate: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        unique=True,
        index=True,
        comment="Patente del vehículo (ej: AB123CD)"
    )

    vehicle_brand: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Marca del vehículo (ej: Toyota, Fiat)"
    )

    vehicle_model: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Modelo del vehículo (ej: Hilux, Ducato)"
    )

    vehicle_year: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Año de fabricación"
    )

    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id", name="fk_vehicles_warehouse_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="FK a warehouse tipo MOBILE (almacén de inventario del vehículo)"
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=VehicleStatus.ACTIVE.value,
        nullable=False,
        index=True,
        comment="Estado operativo del vehículo"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Fecha de creación"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
        comment="Fecha de última actualización"
    )

    # ========== RELATIONSHIPS ==========
    warehouse: Mapped["Warehouse"] = relationship(
        "Warehouse",
        back_populates="vehicle",
        lazy="selectin",
        foreign_keys=[warehouse_id]
    )

    team: Mapped[Optional["Team"]] = relationship(
        "Team",
        back_populates="vehicle",
        lazy="selectin",
        uselist=False,
        foreign_keys="Team.vehicle_id"
    )

    inspections: Mapped[list["VehicleInspection"]] = relationship(
        "VehicleInspection",
        back_populates="vehicle",
        lazy="select",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("vehicle_year >= 1900 AND vehicle_year <= 2200", name="ck_vehicle_year_range"),
    )

    def __repr__(self) -> str:
        return f"<Vehicle(id={self.id}, name='{self.name}', plate='{self.license_plate}')>"

    @property
    def full_name(self) -> str:
        """Nombre completo con patente si existe."""
        if self.license_plate:
            return f"{self.name} ({self.license_plate})"
        return self.name


class VehicleInspection(Base):
    """
    Planilla diaria de control pre-operativo de vehículo (pre-trip inspection).
    """
    __tablename__ = "vehicle_inspections"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único de la inspección"
    )

    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", name="fk_vehicle_inspections_vehicle_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK al vehículo inspeccionado"
    )

    technician_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", name="fk_vehicle_inspections_technician_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="FK al técnico que completa la planilla"
    )

    inspection_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
        index=True,
        comment="Fecha de inspección (1 por vehículo/día)"
    )

    km_actual: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Kilometraje actual informado"
    )

    water_level_ok: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Nivel de agua correcto"
    )

    oil_level_ok: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Nivel de aceite correcto"
    )

    tires_ok: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Neumaticos en buen estado"
    )

    lights_ok: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Luces en correcto funcionamiento"
    )

    cleanliness_ok: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Limpieza general correcta"
    )

    damage_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Observaciones de golpes, rayones u otros danos"
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="OK",
        index=True,
        comment="Estado general: OK, NEEDS_ATTENTION o CRITICAL"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Fecha/hora de carga de la planilla"
    )

    vehicle: Mapped["Vehicle"] = relationship(
        "Vehicle",
        back_populates="inspections",
        lazy="joined"
    )

    technician: Mapped["User"] = relationship(
        "User",
        back_populates="vehicle_inspections",
        lazy="joined"
    )

    __table_args__ = (
        UniqueConstraint("vehicle_id", "inspection_date", name="uq_vehicle_inspections_vehicle_date"),
        CheckConstraint("km_actual >= 0", name="ck_vehicle_inspections_km_non_negative"),
        CheckConstraint(
            "status IN ('OK', 'NEEDS_ATTENTION', 'CRITICAL')",
            name="ck_vehicle_inspections_status_values",
        ),
    )
