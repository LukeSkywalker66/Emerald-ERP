"""Router for installation-related endpoints."""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.installation import InstallationType
from src.schemas.installation import InstallationTypeResponse

router = APIRouter(tags=["installation"])


@router.get("", response_model=List[InstallationTypeResponse])
@router.get("/", response_model=List[InstallationTypeResponse])
def list_installation_types(
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """
    Devuelve los tipos de instalación disponibles.
    
    Args:
        active_only: Si true, solo devuelve tipos activos (default: true)
    
    Returns:
        Lista de tipos de instalación con código, nombre y descripción
    """
    stmt = select(InstallationType).order_by(InstallationType.code)
    
    if active_only:
        stmt = stmt.where(InstallationType.is_active == True)
    
    result = db.execute(stmt).scalars().all()
    return result
