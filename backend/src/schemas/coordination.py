"""
Schemas Pydantic para validación de coordinación/cuadrillas.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from src.models.coordination import TeamRole
from src.schemas.fleet import VehicleSummary


# ========== Team Schemas ==========

class TeamMemberBase(BaseModel):
    """Base schema para miembro de cuadrilla."""
    user_id: int = Field(..., gt=0, description="ID del usuario")
    role: TeamRole = Field(default=TeamRole.technician, description="Rol en la cuadrilla")


class TeamMemberCreate(TeamMemberBase):
    """Schema para agregar miembro a cuadrilla."""
    pass


class TeamMemberResponse(TeamMemberBase):
    """Schema de respuesta para miembro de cuadrilla."""
    id: int
    team_id: int
    created_at: datetime
    
    # Datos del usuario relacionado
    user_name: Optional[str] = Field(None, description="Nombre del usuario")
    user_email: Optional[str] = Field(None, description="Email del usuario")
    
    model_config = ConfigDict(from_attributes=True)


class TeamBase(BaseModel):
    """Base schema para cuadrilla."""
    name: str = Field(..., min_length=3, max_length=150, description="Nombre único de cuadrilla")
    vehicle_id: Optional[int] = Field(None, ge=1, description="ID de warehouse móvil (opcional)")
    is_active: bool = Field(default=True, description="Cuadrilla activa")


class TeamCreate(TeamBase):
    """Schema para crear cuadrilla."""
    pass


class TeamUpdate(BaseModel):
    """Schema para actualizar cuadrilla."""
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    vehicle_id: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class TeamResponse(TeamBase):
    """Schema de respuesta para cuadrilla (sin miembros)."""
    id: int
    created_at: datetime
    updated_at: datetime
    member_count: int
    
    model_config = ConfigDict(from_attributes=True)


class TeamDetailResponse(TeamResponse):
    """Schema de respuesta con miembros incluidos."""
    members: List[TeamMemberResponse] = Field(default_factory=list)
    leader_name: Optional[str] = Field(None, description="Nombre del líder de cuadrilla")
    vehicle: Optional[VehicleSummary] = Field(
        None,
        description="Vehículo asignado a la cuadrilla. Populado via JOIN a tabla vehicles, no es columna propia."
    )
