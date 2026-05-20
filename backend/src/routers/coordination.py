"""
Router para gestión de coordinación (cuadrillas/teams).

Endpoints para CRUD de teams y administración de miembros.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.team_service import TeamService
from src.core.security import get_current_user
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
from src.utils.audit import log_create, log_update, log_delete, get_entity_dict

router = APIRouter(prefix="/api/v2/coordination", tags=["Coordination"])


# ========== TEAMS ENDPOINTS ==========

@router.get("/teams", response_model=List[TeamDetailResponse])
def list_teams(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """
    Obtener todas las cuadrillas.
    
    **Query Params:**
    - `active_only`: Si true, solo cuadrillas activas (default: true)
    
    **Response:** Lista de TeamDetailResponse con miembros
    """
    try:
        service = TeamService(db)
        return service.get_all_teams(active_only=active_only)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar cuadrillas: {str(e)}",
        )


@router.get("/teams/{team_id}", response_model=TeamDetailResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
):
    """
    Obtener detalle de una cuadrilla.
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    
    **Response:** TeamDetailResponse con miembros
    """
    service = TeamService(db)
    team = service.get_team_by_id(team_id)
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cuadrilla {team_id} no encontrada",
        )
    
    return team


@router.post("/teams", response_model=TeamDetailResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Crear nueva cuadrilla.
    
    **Request Body:** TeamCreate
    - `name`: Nombre único (3-150 caracteres)
    - `vehicle_id`: ID de warehouse móvil (opcional)
    - `is_active`: Activa por defecto (boolean)
    
    **Response:** TeamDetailResponse creada
    """
    try:
        service = TeamService(db)
        team = service.create_team(payload)
        
        # Auditoría no bloqueante
        try:
            log_create(
                db=db,
                user_id=current_user.id,
                entity_name="teams",
                entity_id=team.id,
                new_values={"name": team.name, "vehicle_id": team.vehicle_id, "is_active": team.is_active},
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return team
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear cuadrilla: {str(e)}",
        )


@router.put("/teams/{team_id}", response_model=TeamDetailResponse)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Actualizar cuadrilla.
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    
    **Request Body:** TeamUpdate (todos los campos opcionales)
    
    **Response:** TeamDetailResponse actualizada
    """
    try:
        # Capturar estado antes de la mutación
        old_team = db.query(Team).filter(Team.id == team_id).first()
        old_values = get_entity_dict(old_team, fields=["name", "vehicle_id", "is_active"]) if old_team else {}
        
        service = TeamService(db)
        updated = service.update_team(team_id, payload)
        
        # Auditoría no bloqueante
        try:
            log_update(
                db=db,
                user_id=current_user.id,
                entity_name="teams",
                entity_id=team_id,
                old_values=old_values,
                new_values={"name": updated.name, "vehicle_id": updated.vehicle_id, "is_active": updated.is_active},
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return updated
    except ValueError as e:
        if "no existe" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar cuadrilla: {str(e)}",
        )


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Eliminar cuadrilla (soft delete: marcar como inactiva).
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    
    **Response:** 204 No Content
    """
    try:
        # Capturar estado antes de la mutación
        old_team = db.query(Team).filter(Team.id == team_id).first()
        old_values = get_entity_dict(old_team, fields=["name", "vehicle_id", "is_active"]) if old_team else {}
        
        service = TeamService(db)
        service.delete_team(team_id)
        
        # Auditoría no bloqueante
        try:
            log_delete(
                db=db,
                user_id=current_user.id,
                entity_name="teams",
                entity_id=team_id,
                old_values=old_values,
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar cuadrilla: {str(e)}",
        )


# ========== TEAM MEMBERS ENDPOINTS ==========

@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: int,
    payload: TeamMemberCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Agregar miembro a cuadrilla.
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    
    **Request Body:** TeamMemberCreate
    - `user_id`: ID del usuario a agregar
    - `role`: Rol (leader, technician)
    
    **Response:** TeamMemberResponse del miembro agregado
    """
    try:
        service = TeamService(db)
        member = service.add_member(team_id, payload)
        
        # Auditoría no bloqueante
        try:
            log_create(
                db=db,
                user_id=current_user.id,
                entity_name="team_members",
                entity_id=member.id,
                new_values={
                    "team_id": team_id,
                    "user_id": payload.user_id,
                    "role": payload.role,
                    "user_name": member.user_name,
                },
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return member
    except ValueError as e:
        if "no existe" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al agregar miembro: {str(e)}",
        )


@router.delete("/teams/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: int,
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Eliminar miembro de cuadrilla.
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    - `user_id`: ID del usuario a eliminar
    
    **Response:** 204 No Content
    """
    try:
        # Capturar datos del miembro antes de eliminar
        old_member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        ).first()
        
        service = TeamService(db)
        service.remove_member(team_id, user_id)
        
        # Auditoría no bloqueante
        try:
            log_delete(
                db=db,
                user_id=current_user.id,
                entity_name="team_members",
                entity_id=old_member.id if old_member else None,
                old_values={
                    "team_id": team_id,
                    "user_id": user_id,
                    "role": old_member.role if old_member else None,
                },
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar miembro: {str(e)}",
        )


@router.put("/teams/{team_id}/members/{user_id}/role", response_model=TeamMemberResponse)
def update_member_role(
    team_id: int,
    user_id: int,
    role: str,  # "leader" o "technician"
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Actualizar rol de miembro en cuadrilla.
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    - `user_id`: ID del usuario
    
    **Query Params:**
    - `role`: Nuevo rol (leader, technician)
    
    **Response:** TeamMemberResponse actualizado
    """
    try:
        # Capturar rol anterior antes de la mutación
        old_member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        ).first()
        old_role = old_member.role if old_member else None
        
        team_role = TeamRole(role)
        service = TeamService(db)
        updated = service.update_member_role(team_id, user_id, team_role)
        
        # Auditoría no bloqueante
        try:
            log_update(
                db=db,
                user_id=current_user.id,
                entity_name="team_members",
                entity_id=updated.id,
                old_values={"team_id": team_id, "user_id": user_id, "role": old_role},
                new_values={"team_id": team_id, "user_id": user_id, "role": role},
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        
        return updated
    except ValueError as e:
        if "no es un miembro" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol inválido: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar rol: {str(e)}",
        )


@router.get("/users/{user_id}/teams", response_model=List[TeamResponse])
def get_user_teams(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Obtener cuadrillas a las que pertenece un usuario.
    
    **Path Params:**
    - `user_id`: ID del usuario
    
    **Response:** Lista de TeamResponse
    """
    try:
        service = TeamService(db)
        return service.get_user_teams(user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener cuadrillas del usuario: {str(e)}",
        )
