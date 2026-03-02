"""
Service layer para gestión de cuadrillas.

Implementa CRUD de teams, administración de miembros y validaciones.
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from src.models.coordination import Team, TeamMember, TeamRole
from src.models.user import User
from src.schemas.coordination import (
    TeamCreate,
    TeamUpdate,
    TeamMemberCreate,
    TeamResponse,
    TeamDetailResponse,
    TeamMemberResponse,
)


class TeamService:
    """Servicio de gestión de cuadrillas."""

    def __init__(self, db: Session):
        self.db = db

    # ========== CRUD TEAMS ==========

    def get_all_teams(self, active_only: bool = True) -> List[TeamDetailResponse]:
        """
        Obtener todas las cuadrillas.
        
        Args:
            active_only: Si True, solo devuelve cuadrillas activas
            
        Returns:
            Lista de TeamDetailResponse
        """
        query = self.db.query(Team)
        
        if active_only:
            query = query.filter(Team.is_active == True)
        
        teams = query.order_by(Team.name).all()
        
        return [
            TeamDetailResponse(
                id=team.id,
                name=team.name,
                vehicle_id=team.vehicle_id,
                is_active=team.is_active,
                created_at=team.created_at,
                updated_at=team.updated_at,
                member_count=team.member_count,
                members=[
                    TeamMemberResponse(
                        id=m.id,
                        user_id=m.user_id,
                        team_id=m.team_id,
                        role=m.role,
                        created_at=m.created_at,
                        user_name=m.user.full_name or m.user.username,
                        user_email=m.user.email,
                    )
                    for m in team.members
                ],
                leader_name=(
                    team.leader.user.full_name or team.leader.user.username
                    if team.leader else None
                ),
            )
            for team in teams
        ]

    def get_team_by_id(self, team_id: int) -> Optional[TeamDetailResponse]:
        """
        Obtener cuadrilla por ID.
        
        Args:
            team_id: ID de la cuadrilla
            
        Returns:
            TeamDetailResponse o None
        """
        team = self.db.query(Team).filter(Team.id == team_id).first()
        
        if not team:
            return None
        
        return TeamDetailResponse(
            id=team.id,
            name=team.name,
            vehicle_id=team.vehicle_id,
            is_active=team.is_active,
            created_at=team.created_at,
            updated_at=team.updated_at,
            member_count=team.member_count,
            members=[
                TeamMemberResponse(
                    id=m.id,
                    user_id=m.user_id,
                    team_id=m.team_id,
                    role=m.role,
                    created_at=m.created_at,
                    user_name=m.user.full_name or m.user.username,
                    user_email=m.user.email,
                )
                for m in team.members
            ],
            leader_name=(
                team.leader.user.full_name or team.leader.user.username
                if team.leader else None
            ),
        )

    def create_team(self, payload: TeamCreate) -> TeamDetailResponse:
        """
        Crear nueva cuadrilla.
        
        Args:
            payload: TeamCreate con datos de la cuadrilla
            
        Returns:
            TeamDetailResponse de la cuadrilla creada
            
        Raises:
            ValueError: Si el nombre ya existe
        """
        # Verificar si el nombre ya existe
        existing = self.db.query(Team).filter(Team.name == payload.name).first()
        if existing:
            raise ValueError(f"Cuadrilla '{payload.name}' ya existe")
        
        team = Team(
            name=payload.name,
            vehicle_id=payload.vehicle_id,
            is_active=payload.is_active,
        )
        
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        
        return TeamDetailResponse(
            id=team.id,
            name=team.name,
            vehicle_id=team.vehicle_id,
            is_active=team.is_active,
            created_at=team.created_at,
            updated_at=team.updated_at,
            member_count=0,
            members=[],
            leader_name=None,
        )

    def update_team(self, team_id: int, payload: TeamUpdate) -> TeamDetailResponse:
        """
        Actualizar cuadrilla.
        
        Args:
            team_id: ID de la cuadrilla
            payload: TeamUpdate con campos a actualizar
            
        Returns:
            TeamDetailResponse de la cuadrilla actualizada
            
        Raises:
            ValueError: Si no existe la cuadrilla o nombre duplicado
        """
        team = self.db.query(Team).filter(Team.id == team_id).first()
        
        if not team:
            raise ValueError(f"Cuadrilla {team_id} no existe")
        
        # Si se cambia el nombre, verificar unicidad
        if payload.name and payload.name != team.name:
            existing = self.db.query(Team).filter(Team.name == payload.name).first()
            if existing:
                raise ValueError(f"Cuadrilla '{payload.name}' ya existe")
            team.name = payload.name
        
        if payload.vehicle_id is not None:
            team.vehicle_id = payload.vehicle_id
        
        if payload.is_active is not None:
            team.is_active = payload.is_active
        
        self.db.commit()
        self.db.refresh(team)
        
        return self.get_team_by_id(team_id)

    def delete_team(self, team_id: int) -> bool:
        """
        Eliminar cuadrilla (soft delete: marcar como inactiva).
        
        Args:
            team_id: ID de la cuadrilla
            
        Returns:
            True si se marcó como inactiva
            
        Raises:
            ValueError: Si no existe
        """
        team = self.db.query(Team).filter(Team.id == team_id).first()
        
        if not team:
            raise ValueError(f"Cuadrilla {team_id} no existe")
        
        team.is_active = False
        self.db.commit()
        
        return True

    # ========== MEMBERS MANAGEMENT ==========

    def add_member(
        self, team_id: int, payload: TeamMemberCreate
    ) -> TeamMemberResponse:
        """
        Agregar miembro a cuadrilla.
        
        Args:
            team_id: ID de la cuadrilla
            payload: TeamMemberCreate con user_id y role
            
        Returns:
            TeamMemberResponse del miembro agregado
            
        Raises:
            ValueError: Si cuadrilla/usuario no existen o usuario ya está en la cuadrilla
        """
        # Verificar que la cuadrilla existe
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError(f"Cuadrilla {team_id} no existe")
        
        # Verificar que el usuario existe
        user = self.db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise ValueError(f"Usuario {payload.user_id} no existe")
        
        # Verificar que no existe ya la membresía
        existing = (
            self.db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == payload.user_id,
            )
            .first()
        )
        if existing:
            raise ValueError(
                f"Usuario {payload.user_id} ya es miembro de la cuadrilla {team_id}"
            )
        
        member = TeamMember(
            team_id=team_id,
            user_id=payload.user_id,
            role=payload.role,
        )
        
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        
        return TeamMemberResponse(
            id=member.id,
            user_id=member.user_id,
            team_id=member.team_id,
            role=member.role,
            created_at=member.created_at,
            user_name=user.full_name or user.username,
            user_email=user.email,
        )

    def remove_member(self, team_id: int, user_id: int) -> bool:
        """
        Eliminar miembro de cuadrilla.
        
        Args:
            team_id: ID de la cuadrilla
            user_id: ID del usuario
            
        Returns:
            True si se eliminó
            
        Raises:
            ValueError: Si no existe la membresía
        """
        member = (
            self.db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
            .first()
        )
        
        if not member:
            raise ValueError(f"Usuario {user_id} no es miembro de la cuadrilla {team_id}")
        
        self.db.delete(member)
        self.db.commit()
        
        return True

    def update_member_role(
        self, team_id: int, user_id: int, role: TeamRole
    ) -> TeamMemberResponse:
        """
        Actualizar rol de miembro en cuadrilla.
        
        Args:
            team_id: ID de la cuadrilla
            user_id: ID del usuario
            role: Nuevo rol
            
        Returns:
            TeamMemberResponse actualizado
            
        Raises:
            ValueError: Si no existe la membresía
        """
        member = (
            self.db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
            .first()
        )
        
        if not member:
            raise ValueError(f"Usuario {user_id} no es miembro de la cuadrilla {team_id}")
        
        member.role = role
        self.db.commit()
        self.db.refresh(member)
        
        user = self.db.query(User).filter(User.id == user_id).first()
        
        return TeamMemberResponse(
            id=member.id,
            user_id=member.user_id,
            team_id=member.team_id,
            role=member.role,
            created_at=member.created_at,
            user_name=user.full_name or user.username if user else None,
            user_email=user.email if user else None,
        )

    def get_user_teams(self, user_id: int) -> List[TeamResponse]:
        """
        Obtener cuadrillas a las que pertenece un usuario.
        
        Args:
            user_id: ID del usuario
            
        Returns:
            Lista de TeamResponse
        """
        memberships = (
            self.db.query(TeamMember)
            .filter(TeamMember.user_id == user_id)
            .all()
        )
        
        teams = [m.team for m in memberships]
        
        return [
            TeamResponse(
                id=team.id,
                name=team.name,
                vehicle_id=team.vehicle_id,
                is_active=team.is_active,
                created_at=team.created_at,
                updated_at=team.updated_at,
                member_count=team.member_count,
            )
            for team in teams
        ]
