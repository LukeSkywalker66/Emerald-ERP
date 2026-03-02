"""Schemas para gestión de flota (vehículos)."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class VehicleBase(BaseModel):
    """Base schema para vehículo."""
    name: str = Field(..., min_length=3, max_length=150)
    license_plate: Optional[str] = Field(None, max_length=20)
    vehicle_brand: Optional[str] = Field(None, max_length=50)
    vehicle_model: Optional[str] = Field(None, max_length=50)
    vehicle_year: Optional[int] = Field(None, ge=1900, le=2200)
    status: str = Field(default="ACTIVE")


class VehicleCreate(VehicleBase):
    """Schema para crear vehículo."""
    pass


class VehicleUpdate(BaseModel):
    """Schema para actualizar vehículo."""
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    license_plate: Optional[str] = Field(None, max_length=20)
    vehicle_brand: Optional[str] = Field(None, max_length=50)
    vehicle_model: Optional[str] = Field(None, max_length=50)
    vehicle_year: Optional[int] = Field(None, ge=1900, le=2200)
    status: Optional[str] = None


class VehicleResponse(VehicleBase):
    """Schema de respuesta para vehículo."""
    id: int
    warehouse_id: int
    warehouse_name: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class VehicleDetailResponse(VehicleResponse):
    """Respuesta detallada incluye team asignado."""
    team_id: Optional[int] = None
    team_name: Optional[str] = None
