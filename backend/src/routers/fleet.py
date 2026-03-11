"""Router para gestión de flota (vehículos)."""
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.database import get_db
from src.core.security import get_current_user
from src.models.fleet import Vehicle, VehicleStatus, VehicleInspection
from src.models.inventory import Warehouse, WarehouseType
from src.models.coordination import Team
from src.models.user import User
from src.schemas.fleet import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    VehicleDetailResponse,
    VehicleInspectionCreate,
    VehicleInspectionResponse,
)
from src.utils.audit import log_create


router = APIRouter(prefix="/api/v2/vehicles", tags=["Fleet"])
inspection_router = APIRouter(prefix="/api/v2/fleet", tags=["Fleet Inspections"])


def _require_admin_or_operator(current_user: User = Depends(get_current_user)) -> User:
    """Permite acceso solo a roles admin u operador."""
    user_role = (current_user.role_name or "").lower()
    if user_role not in {"admin", "operador", "operator"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requiere rol admin u operador",
        )
    return current_user


def _create_mobile_warehouse(db: Session, vehicle_name: str) -> Warehouse:
    """Crea un Warehouse de tipo MOBILE para el vehículo."""
    warehouse_name = f"Stock - {vehicle_name}"
    
    warehouse = Warehouse(
        name=warehouse_name,
        type=WarehouseType.MOBILE,
    )
    db.add(warehouse)
    db.flush()  # Para obtener el warehouse_id
    return warehouse


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(vehicle_data: VehicleCreate, db: Session = Depends(get_db)):
    """
    Crear nuevo vehículo y su warehouse asociado automáticamente.
    
    El warehouse se crea con tipo=MOBILE y nombre="Stock - {vehicle.name}".
    """
    # Verificar patente única (si se provee)
    if vehicle_data.license_plate:
        existing = db.execute(
            select(Vehicle).where(Vehicle.license_plate == vehicle_data.license_plate)
        ).scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un vehículo con patente {vehicle_data.license_plate}",
            )
    
    # Validar status
    try:
        vehicle_status = VehicleStatus[vehicle_data.status]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status inválido. Usar: {[s.value for s in VehicleStatus]}",
        )
    
    # Crear warehouse primero
    warehouse = _create_mobile_warehouse(db, vehicle_data.name)
    
    # Crear vehículo
    vehicle = Vehicle(
        name=vehicle_data.name,
        license_plate=vehicle_data.license_plate,
        vehicle_brand=vehicle_data.vehicle_brand,
        vehicle_model=vehicle_data.vehicle_model,
        vehicle_year=vehicle_data.vehicle_year,
        status=vehicle_status.value,  # Asignar el string value del enum
        warehouse_id=warehouse.id,
    )
    
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    db.refresh(warehouse)
    
    # Construir respuesta
    response = VehicleResponse(
        id=vehicle.id,
        name=vehicle.name,
        license_plate=vehicle.license_plate,
        vehicle_brand=vehicle.vehicle_brand,
        vehicle_model=vehicle.vehicle_model,
        vehicle_year=vehicle.vehicle_year,
        status=vehicle.status,
        warehouse_id=vehicle.warehouse_id,
        warehouse_name=warehouse.name,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
    )
    
    return response


@router.get("", response_model=List[VehicleDetailResponse])
def list_vehicles(
    status_filter: str = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    """Listar vehículos con filtros opcionales."""
    query = select(Vehicle)
    
    if status_filter:
        try:
            # Validar que es un VehicleStatus válido
            VehicleStatus[status_filter]
            query = query.where(Vehicle.status == status_filter)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status inválido. Usar: {[s.value for s in VehicleStatus]}",
            )
    
    vehicles = db.execute(query).scalars().all()
    
    # Obtener teams asignados
    result = []
    for vehicle in vehicles:
        team = db.execute(
            select(Team).where(Team.vehicle_id == vehicle.id)
        ).scalars().first()  # Usar first() en lugar de scalar_one_or_none()
        
        response = VehicleDetailResponse(
            id=vehicle.id,
            name=vehicle.name,
            license_plate=vehicle.license_plate,
            vehicle_brand=vehicle.vehicle_brand,
            vehicle_model=vehicle.vehicle_model,
            vehicle_year=vehicle.vehicle_year,
            status=vehicle.status,
            warehouse_id=vehicle.warehouse_id,
            warehouse_name=vehicle.warehouse.name,
            created_at=vehicle.created_at,
            updated_at=vehicle.updated_at,
            team_id=team.id if team else None,
            team_name=team.name if team else None,
        )
        result.append(response)
    
    return result


@router.get("/{vehicle_id}", response_model=VehicleDetailResponse)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """Obtener detalle de un vehículo."""
    vehicle = db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    ).scalar_one_or_none()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )
    
    # Obtener team asignado
    team = db.execute(
        select(Team).where(Team.vehicle_id == vehicle.id)
    ).scalars().first()  # Usar first() en lugar de scalar_one_or_none()
    
    response = VehicleDetailResponse(
        id=vehicle.id,
        name=vehicle.name,
        license_plate=vehicle.license_plate,
        vehicle_brand=vehicle.vehicle_brand,
        vehicle_model=vehicle.vehicle_model,
        vehicle_year=vehicle.vehicle_year,
        status=vehicle.status,
        warehouse_id=vehicle.warehouse_id,
        warehouse_name=vehicle.warehouse.name,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
        team_id=team.id if team else None,
        team_name=team.name if team else None,
    )
    
    return response


@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_data: VehicleUpdate,
    db: Session = Depends(get_db),
):
    """Actualizar vehículo."""
    vehicle = db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    ).scalar_one_or_none()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )
    
    # Verificar patente única (si se está actualizando)
    if vehicle_data.license_plate and vehicle_data.license_plate != vehicle.license_plate:
        existing = db.execute(
            select(Vehicle).where(
                Vehicle.license_plate == vehicle_data.license_plate,
                Vehicle.id != vehicle_id,
            )
        ).scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un vehículo con patente {vehicle_data.license_plate}",
            )
    
    # Actualizar campos
    update_data = vehicle_data.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        try:
            update_data["status"] = VehicleStatus[update_data["status"]].value
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status inválido. Usar: {[s.value for s in VehicleStatus]}",
            )
    
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    
    db.commit()
    db.refresh(vehicle)
    
    response = VehicleResponse(
        id=vehicle.id,
        name=vehicle.name,
        license_plate=vehicle.license_plate,
        vehicle_brand=vehicle.vehicle_brand,
        vehicle_model=vehicle.vehicle_model,
        vehicle_year=vehicle.vehicle_year,
        status=vehicle.status,
        warehouse_id=vehicle.warehouse_id,
        warehouse_name=vehicle.warehouse.name,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
    )
    
    return response


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """
    Soft-delete de vehículo (marcar como RETIRED).
    
    No elimina físicamente el registro por integridad con Team y Warehouse.
    """
    vehicle = db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    ).scalar_one_or_none()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )
    
    # Verificar si tiene team asignado
    team = db.execute(
        select(Team).where(Team.vehicle_id == vehicle.id)
    ).scalars().first()  # Usar first() en lugar de scalar_one_or_none()
    
    if team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar: vehículo asignado al equipo {team.name}",
        )
    
    vehicle.status = VehicleStatus.RETIRED.value
    db.commit()
    
    return None


@inspection_router.post(
    "/inspections",
    response_model=VehicleInspectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vehicle_inspection(
    payload: VehicleInspectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crear planilla diaria de inspección pre-trip para un vehículo."""
    vehicle = db.execute(
        select(Vehicle).where(Vehicle.id == payload.vehicle_id)
    ).scalar_one_or_none()

    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )

    inspection = VehicleInspection(
        vehicle_id=payload.vehicle_id,
        technician_id=current_user.id,
        inspection_date=date.today(),
        km_actual=payload.km_actual,
        water_level_ok=payload.water_level_ok,
        oil_level_ok=payload.oil_level_ok,
        tires_ok=payload.tires_ok,
        lights_ok=payload.lights_ok,
        cleanliness_ok=payload.cleanliness_ok,
        damage_notes=payload.damage_notes,
        status=payload.status,
    )

    db.add(inspection)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una inspección para este vehículo en la fecha de hoy",
        )

    db.refresh(inspection)

    # Auditoría no bloqueante
    try:
        log_create(
            db=db,
            user_id=current_user.id,
            entity_name="vehicle_inspections",
            entity_id=inspection.id,
            new_values={
                "vehicle_id": inspection.vehicle_id,
                "technician_id": inspection.technician_id,
                "inspection_date": inspection.inspection_date.isoformat(),
                "km_actual": inspection.km_actual,
                "water_level_ok": inspection.water_level_ok,
                "oil_level_ok": inspection.oil_level_ok,
                "tires_ok": inspection.tires_ok,
                "lights_ok": inspection.lights_ok,
                "cleanliness_ok": inspection.cleanliness_ok,
                "damage_notes": inspection.damage_notes,
                "status": inspection.status,
            },
        )
    except Exception:
        pass

    return VehicleInspectionResponse(
        id=inspection.id,
        vehicle_id=inspection.vehicle_id,
        vehicle_name=vehicle.name,
        technician_id=inspection.technician_id,
        technician_name=(current_user.full_name or current_user.username),
        inspection_date=inspection.inspection_date,
        km_actual=inspection.km_actual,
        water_level_ok=inspection.water_level_ok,
        oil_level_ok=inspection.oil_level_ok,
        tires_ok=inspection.tires_ok,
        lights_ok=inspection.lights_ok,
        cleanliness_ok=inspection.cleanliness_ok,
        damage_notes=inspection.damage_notes,
        status=inspection.status,
        created_at=inspection.created_at,
    )


@inspection_router.get(
    "/vehicles/{vehicle_id}/inspections/today",
    response_model=VehicleInspectionResponse,
)
def get_today_vehicle_inspection(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtener inspección de hoy para un vehículo. Retorna 404 si no existe."""
    vehicle = db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id)
    ).scalar_one_or_none()

    if vehicle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehículo no encontrado",
        )

    inspection = db.execute(
        select(VehicleInspection).where(
            VehicleInspection.vehicle_id == vehicle_id,
            VehicleInspection.inspection_date == date.today(),
        )
    ).scalar_one_or_none()

    if inspection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe inspección para hoy",
        )

    return VehicleInspectionResponse(
        id=inspection.id,
        vehicle_id=inspection.vehicle_id,
        vehicle_name=vehicle.name,
        technician_id=inspection.technician_id,
        technician_name=(inspection.technician.full_name or inspection.technician.username)
        if inspection.technician
        else None,
        inspection_date=inspection.inspection_date,
        km_actual=inspection.km_actual,
        water_level_ok=inspection.water_level_ok,
        oil_level_ok=inspection.oil_level_ok,
        tires_ok=inspection.tires_ok,
        lights_ok=inspection.lights_ok,
        cleanliness_ok=inspection.cleanliness_ok,
        damage_notes=inspection.damage_notes,
        status=inspection.status,
        created_at=inspection.created_at,
    )


@inspection_router.get(
    "/inspections",
    response_model=List[VehicleInspectionResponse],
)
def list_vehicle_inspections(
    vehicle_id: int | None = Query(default=None),
    inspection_date: date | None = Query(default=None),
    authorized_user: User = Depends(_require_admin_or_operator),
    db: Session = Depends(get_db),
):
    """Histórico de planillas de inspección (solo admin/operador)."""
    stmt = select(VehicleInspection).order_by(
        VehicleInspection.inspection_date.desc(),
        VehicleInspection.created_at.desc(),
    )

    if vehicle_id is not None:
        stmt = stmt.where(VehicleInspection.vehicle_id == vehicle_id)
    if inspection_date is not None:
        stmt = stmt.where(VehicleInspection.inspection_date == inspection_date)

    inspections = db.execute(stmt).scalars().all()

    return [
        VehicleInspectionResponse(
            id=item.id,
            vehicle_id=item.vehicle_id,
            vehicle_name=item.vehicle.name if item.vehicle else None,
            technician_id=item.technician_id,
            technician_name=(item.technician.full_name or item.technician.username)
            if item.technician
            else None,
            inspection_date=item.inspection_date,
            km_actual=item.km_actual,
            water_level_ok=item.water_level_ok,
            oil_level_ok=item.oil_level_ok,
            tires_ok=item.tires_ok,
            lights_ok=item.lights_ok,
            cleanliness_ok=item.cleanliness_ok,
            damage_notes=item.damage_notes,
            status=item.status,
            created_at=item.created_at,
        )
        for item in inspections
    ]
