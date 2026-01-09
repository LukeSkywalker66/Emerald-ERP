"""
Router para gestión de roles (v2)
Solo lectura para usuarios autenticados
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user
from src.repositories.role_repository import RoleRepository
from src.schemas.user_schemas import RoleResponse

router = APIRouter(prefix="/roles", tags=["roles-v2"])


@router.get("/", response_model=List[RoleResponse])
async def list_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Listar todos los roles disponibles.
    
    Acceso: Usuarios autenticados (para usar en selects de formularios)
    """
    role_repo = RoleRepository(db)
    roles = role_repo.get_all()
    return roles
