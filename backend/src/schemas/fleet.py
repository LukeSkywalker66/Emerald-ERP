"""Schemas para gestión de flota (vehículos e inspecciones diarias)."""
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


LEVEL_ALIASES = {
    "bajo": "bajo",
    "low": "bajo",
    "minimo": "minimo",
    "minimo.": "minimo",
    "mínimo": "minimo",
    "minimum": "minimo",
    "medio": "medio",
    "medium": "medio",
    "alto": "alto",
    "high": "alto",
}


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


class VehicleSummary(BaseModel):
    """
    Resumen minimalista de vehículo para incluir como objeto anidado
    en respuestas de otros módulos (Warehouse, Team).
    
    NO es una tabla — se popula exclusivamente vía JOIN a la tabla vehicles
    en runtime. Sin datos duplicados, sin columnas adicionales.
    """
    id: int
    name: str
    license_plate: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    full_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VehicleInspectionCreate(BaseModel):
    """Payload para crear planilla diaria de inspección de vehículo."""
    vehicle_id: int = Field(..., gt=0)
    km_actual: int = Field(..., ge=0)
    mechanical_conditions: Optional[str] = Field(None, max_length=2000)
    oil_level: Literal["bajo", "minimo", "medio", "alto"] = "medio"
    water_level: Literal["bajo", "minimo", "medio", "alto"] = "medio"
    fuel_level: Literal["bajo", "minimo", "medio", "alto"] = "medio"
    brake_fluid_level: Literal["bajo", "minimo", "medio", "alto"] = "medio"

    has_hydraulic_leaks: bool = False
    pulls_to_one_side: bool = False
    oil_leaks: bool = False
    hose_leaks: bool = False
    radiator_leaks: bool = False

    low_beam_lights_ok: bool = True
    high_beam_lights_ok: bool = True
    hazard_lights_ok: bool = True
    brake_lights_ok: bool = True
    position_lights_ok: bool = True
    reverse_lights_ok: bool = True
    fog_lights_ok: bool = True
    dashboard_indicators_on: bool = False
    reverse_alarm_ok: bool = True

    tires_cuts_or_bulges: bool = False
    has_spare_tire: bool = True
    has_lug_wrench: bool = True
    has_jack: bool = True
    tires_pressure_ok_30psi: bool = True

    seatbelts_all_ok: bool = True
    horn_ok: bool = True
    mirrors_ok: bool = True
    has_two_safety_cones: bool = True
    fire_extinguisher_ok: bool = True
    wipers_ok: bool = True

    water_level_ok: bool = True
    oil_level_ok: bool = True
    tires_ok: bool = True
    lights_ok: bool = True
    cleanliness_ok: bool = True
    damage_notes: Optional[str] = Field(None, max_length=2000)
    status: Literal["OK", "NEEDS_ATTENTION", "CRITICAL"] = "OK"

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_level_keys(cls, data):
        """Compatibilidad con clientes legacy que usan claves alternativas."""
        if not isinstance(data, dict):
            return data

        if "water_level" not in data and "coolant_level" in data:
            data["water_level"] = data["coolant_level"]

        return data

    @field_validator("oil_level", "water_level", "fuel_level", "brake_fluid_level", mode="before")
    @classmethod
    def normalize_levels(cls, value):
        """Normaliza niveles a enums canónicos en español para persistencia consistente."""
        if value is None:
            return value

        normalized = str(value).strip().lower()
        mapped = LEVEL_ALIASES.get(normalized)
        if mapped:
            return mapped

        raise ValueError("Nivel inválido. Use: bajo|minimo|medio|alto")


class VehicleInspectionResponse(BaseModel):
    """Respuesta para inspecciones de vehículo."""
    id: int
    vehicle_id: int
    vehicle_name: Optional[str] = None
    technician_id: int
    technician_name: Optional[str] = None
    inspection_date: date
    km_actual: int
    mechanical_conditions: Optional[str] = None
    oil_level: str
    water_level: str
    fuel_level: str
    brake_fluid_level: str

    has_hydraulic_leaks: bool
    pulls_to_one_side: bool
    oil_leaks: bool
    hose_leaks: bool
    radiator_leaks: bool

    low_beam_lights_ok: bool
    high_beam_lights_ok: bool
    hazard_lights_ok: bool
    brake_lights_ok: bool
    position_lights_ok: bool
    reverse_lights_ok: bool
    fog_lights_ok: bool
    dashboard_indicators_on: bool
    reverse_alarm_ok: bool

    tires_cuts_or_bulges: bool
    has_spare_tire: bool
    has_lug_wrench: bool
    has_jack: bool
    tires_pressure_ok_30psi: bool

    seatbelts_all_ok: bool
    horn_ok: bool
    mirrors_ok: bool
    has_two_safety_cones: bool
    fire_extinguisher_ok: bool
    wipers_ok: bool

    water_level_ok: bool
    oil_level_ok: bool
    tires_ok: bool
    lights_ok: bool
    cleanliness_ok: bool
    damage_notes: Optional[str] = None
    status: str
    status_label: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
