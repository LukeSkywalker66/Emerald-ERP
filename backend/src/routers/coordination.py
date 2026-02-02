"""
Router para gestión de coordinación (cuadrillas/teams).

Endpoints para CRUD de teams y administración de miembros.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.services.team_service import TeamService
from src.models.coordination import TeamRole
from src.schemas.coordination import (
    TeamCreate,
    TeamUpdate,
    TeamMemberCreate,
    TeamResponse,
    TeamDetailResponse,
    TeamMemberResponse,
)

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
        return service.create_team(payload)
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
        service = TeamService(db)
        return service.update_team(team_id, payload)
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
    db: Session = Depends(get_db),
):
    """
    Eliminar cuadrilla (soft delete: marcar como inactiva).
    
    **Path Params:**
    - `team_id`: ID de la cuadrilla
    
    **Response:** 204 No Content
    """
    try:
        service = TeamService(db)
        service.delete_team(team_id)
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
        return service.add_member(team_id, payload)
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
        service = TeamService(db)
        service.remove_member(team_id, user_id)
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
        team_role = TeamRole(role)
        service = TeamService(db)
        return service.update_member_role(team_id, user_id, team_role)
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
