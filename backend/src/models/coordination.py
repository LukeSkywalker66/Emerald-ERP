"""
Modelos para el módulo de Coordinación - Cuadrillas (Teams).

Define Teams (equipos de técnicos) y sus miembros con roles.
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from src.database import Base


class TeamRole(str, enum.Enum):
    """Roles dentro de una cuadrilla."""
    leader = "leader"          # Jefe/Responsable
    technician = "technician"  # Técnico operativo


class Team(Base):
    """
    Modelo de Cuadrilla (Team) - Unidad operativa de técnicos.
    
    Una cuadrilla es un grupo de técnicos que trabajan juntos.
    Puede estar asociada a un vehículo móvil (warehouse).
    """
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único de la cuadrilla"
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        unique=True,
        index=True,
        comment="Nombre único de la cuadrilla (ej: 'Móvil 01 - Norte')"
    )

    vehicle_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("vehicles.id", name="fk_teams_vehicle_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="FK a vehicles (reemplaza viejo soft reference)"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Cuadrilla activa o archivada"
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

    # Relationships
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    work_orders: Mapped[List["WorkOrder"]] = relationship(
        "WorkOrder",
        back_populates="team",
        lazy="select",
        foreign_keys="WorkOrder.team_id"
    )

    # ========== NUEVA RELACIÓN: Vehicle ==========
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle",
        back_populates="team",
        lazy="selectin",
        foreign_keys=[vehicle_id]
    )

    def __repr__(self) -> str:
        return f"<Team(id={self.id}, name='{self.name}', active={self.is_active})>"

    @property
    def member_count(self) -> int:
        """Retorna cantidad de miembros activos."""
        return len(self.members) if self.members else 0

    @property
    def leader(self) -> Optional["TeamMember"]:
        """Retorna el líder de la cuadrilla."""
        if not self.members:
            return None
        leaders = [m for m in self.members if m.role == TeamRole.leader]
        return leaders[0] if leaders else None


class TeamMember(Base):
    """
    Modelo de Miembro de Cuadrilla.
    
    Asocia usuarios a equipos con un rol específico.
    """
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        comment="ID único del miembro de cuadrilla"
    )

    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", name="fk_team_members_team_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a teams"
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", name="fk_team_members_user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK a users"
    )

    role: Mapped[TeamRole] = mapped_column(
        SQLEnum(TeamRole, name="team_role_enum", native_enum=False),
        default=TeamRole.technician,
        nullable=False,
        comment="Rol dentro de la cuadrilla (leader, technician)"
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

    # Relationships
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="members",
        lazy="joined"
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="team_memberships",
        lazy="joined"
    )

    # Índices compuestos: Un usuario solo puede estar una vez por cuadrilla
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_members_team_user"),
    )

    def __repr__(self) -> str:
        return f"<TeamMember(team_id={self.team_id}, user_id={self.user_id}, role={self.role})>"
