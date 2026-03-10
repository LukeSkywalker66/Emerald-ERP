"""Schemas para gestión de flota (vehículos e inspecciones diarias)."""
from datetime import datetime, date
from typing import Optional, Literal
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


class VehicleInspectionCreate(BaseModel):
    """Payload para crear planilla diaria de inspección de vehículo."""
    vehicle_id: int = Field(..., gt=0)
    km_actual: int = Field(..., ge=0)
    water_level_ok: bool = True
    oil_level_ok: bool = True
    tires_ok: bool = True
    lights_ok: bool = True
    cleanliness_ok: bool = True
    damage_notes: Optional[str] = Field(None, max_length=2000)
    status: Literal["OK", "NEEDS_ATTENTION", "CRITICAL"] = "OK"


class VehicleInspectionResponse(BaseModel):
    """Respuesta para inspecciones de vehículo."""
    id: int
    vehicle_id: int
    vehicle_name: Optional[str] = None
    technician_id: int
    technician_name: Optional[str] = None
    inspection_date: date
    km_actual: int
    water_level_ok: bool
    oil_level_ok: bool
    tires_ok: bool
    lights_ok: bool
    cleanliness_ok: bool
    damage_notes: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
