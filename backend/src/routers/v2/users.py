"""
Router de administración de usuarios (v2)

Endpoints protegidos para gestión de usuarios: crear, resetear contraseña,
cambiar rol, activar/desactivar. Requiere superusuario.
"""
import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_active_superuser, get_password_hash
from src.repositories.user_repository import UserRepository, RoleRepository
from src.schemas.user_schemas import (
    UserCreate,
    UserResponse,
    PasswordResetResponse,
    RoleChangeRequest,
    StatusUpdateRequest,
)
from src.services.audit_service import AuditService, get_client_ip


router = APIRouter(tags=["Users V2"])


def _generate_temporary_password(length: int = 14) -> str:
    """Genera una contraseña temporal robusta.

    Reglas: mínimo 1 mayúscula, 1 minúscula, 1 dígito y 1 símbolo.
    """
    if length < 8:
        length = 8
    categories = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*()-_=+[]{};:,.?/"),
    ]
    pool = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{};:,.?/"
    remaining = [secrets.choice(pool) for _ in range(length - len(categories))]
    chars = categories + remaining
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


@router.get("/", response_model=list[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_active_superuser),
):
    """Lista todos los usuarios del sistema (solo superusuarios)."""
    user_repo = UserRepository(db)
    users = user_repo.get_all(skip=skip, limit=limit)
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_active_superuser),
):
    """Crea un usuario (solo superusuarios)."""
    user_repo = UserRepository(db)

    # Unicidad de email/username
    if user_repo.get_by_email(data.email):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    if user_repo.get_by_username(data.username):
        raise HTTPException(status_code=400, detail="Username ya en uso")

    # Hash de password
    hashed = get_password_hash(data.password)

    from src.models.user import User
    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=hashed,
        is_active=True,
        is_superuser=False,
        role_id=data.role_id,
    )
    created = user_repo.create(user)

    # Audit
    try:
        AuditService.log_action(
            db=db,
            user_id=_admin.id,
            action="user.create",
            entity_type="User",
            entity_id=created.id,
            ip_address=get_client_ip(request),
            status="success",
            details={"email": created.email, "username": created.username},
        )
    except Exception:
        pass

    return created


@router.post("/{user_id}/reset-password", response_model=PasswordResetResponse)
def reset_password_admin(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_active_superuser),
):
    """Resetea contraseña de un usuario y retorna la temporal (solo admin)."""
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes resetear tu propia contraseña aquí")

    temp_password = _generate_temporary_password()
    user.hashed_password = get_password_hash(temp_password)
    user_repo.update(user)

    # Audit
    try:
        AuditService.log_action(
            db=db,
            user_id=current_admin.id,
            action="user.reset_password",
            entity_type="User",
            entity_id=user.id,
            ip_address=get_client_ip(request),
            status="success",
        )
    except Exception:
        pass

    return PasswordResetResponse(user_id=user.id, temporary_password=temp_password)


@router.patch("/{user_id}/role", response_model=UserResponse)
def change_user_role(
    user_id: int,
    payload: RoleChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_active_superuser),
):
    """Cambia el rol de un usuario (solo admin)."""
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")

    role = role_repo.get(payload.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    user.role_id = role.id
    updated = user_repo.update(user)

    # Audit
    try:
        AuditService.log_action(
            db=db,
            user_id=current_admin.id,
            action="user.change_role",
            entity_type="User",
            entity_id=user.id,
            ip_address=get_client_ip(request),
            status="success",
            details={"new_role_id": role.id, "new_role_name": role.name},
        )
    except Exception:
        pass

    return updated


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    payload: StatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_active_superuser),
):
    """Activa o desactiva un usuario (solo admin)."""
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio estado")

    user.is_active = bool(payload.is_active)
    updated = user_repo.update(user)

    # Audit
    try:
        AuditService.log_action(
            db=db,
            user_id=current_admin.id,
            action="user.update_status",
            entity_type="User",
            entity_id=user.id,
            ip_address=get_client_ip(request),
            status="success",
            details={"is_active": updated.is_active},
        )
    except Exception:
        pass

    return updated
