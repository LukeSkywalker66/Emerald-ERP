"""
Router de autenticación (login, registro, etc.)
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.database import get_db
from src.repositories.user_repository import UserRepository
from src.services.auth_service import AuthService
from src.schemas.user_schemas import (
    Token,
    UserCreate,
    UserResponse,
)
from src.core.security import get_current_user
from src.models.user import User


logger = logging.getLogger("Emerald.AuthRouter")

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Dependency para obtener una instancia de AuthService."""
    user_repo = UserRepository(db)
    return AuthService(user_repo, db)


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Endpoint de login para usuarios.
    
    Acepta tanto email como username en el campo 'username'.
    """
    token = auth_service.login(
        email=form_data.username,  # Puede ser email o username
        password=form_data.password
    )
    
    if not token:
        logger.warning(f"Login fallido para: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Endpoint para registrar nuevos usuarios."""
    try:
        user = auth_service.register_user(user_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Endpoint para obtener información del usuario actual."""
    return current_user


@router.post("/change-password")
def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Endpoint para cambiar el password del usuario actual."""
    try:
        auth_service.change_password(
            user_id=current_user.id,
            old_password=old_password,
            new_password=new_password
        )
        return {"message": "Password cambiado exitosamente"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
