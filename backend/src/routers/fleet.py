"""Router para gestión de flota (vehículos)."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from src.database import get_db
from src.models.fleet import Vehicle, VehicleStatus
from src.models.inventory import Warehouse, WarehouseType
from src.models.coordination import Team
from src.schemas.fleet import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    VehicleDetailResponse,
)


router = APIRouter(prefix="/api/v2/vehicles", tags=["Fleet"])


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
    status: str = None,
    db: Session = Depends(get_db),
):
    """Listar vehículos con filtros opcionales."""
    query = select(Vehicle)
    
    if status:
        try:
            # Validar que es un VehicleStatus válido
            VehicleStatus[status]
            query = query.where(Vehicle.status == status)
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
