"""
Router de autenticación (login, registro, etc.)
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from src.database import get_db
from src.repositories.user_repository import UserRepository
from src.services.auth_service import AuthService
from src.services.audit_service import AuditService, get_client_ip
from src.services.rate_limit_service import RateLimitService
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
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    db: Session = Depends(get_db)
):
    """
    Endpoint de login para usuarios.
    
    Acepta tanto email como username en el campo 'username'.
    Registra todos los intentos de login en el audit log.
    Implementa rate limiting para prevenir brute force attacks.
    """
    ip_address = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    # Verificar rate limiting (solo si la tabla existe)
    try:
        is_allowed, message = RateLimitService.check_rate_limit(
            db=db,
            username_or_email=form_data.username,
            ip_address=ip_address,
        )
        
        if not is_allowed:
            logger.warning(f"[RATE_LIMIT] Blocked login attempt for: {form_data.username} from {ip_address}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message,
            )
    except Exception as e:
        if "relation" in str(e) and "login_attempts" in str(e):
            # Tabla de audit no existe aún, continuar sin rate limiting
            logger.warning(f"[AUDIT] Tabla login_attempts no existe, rate limiting desactivado")
        else:
            raise
    
    # Intentar login
    token = auth_service.login(
        email=form_data.username,  # Puede ser email o username
        password=form_data.password
    )
    
    if not token:
        logger.warning(f"Login fallido para: {form_data.username}")
        
        # Registrar intento fallido (si la tabla existe)
        try:
            AuditService.log_login_attempt(
                db=db,
                username_or_email=form_data.username,
                ip_address=ip_address,
                success=False,
                user_agent=user_agent,
            )
        except Exception as e:
            if "relation" not in str(e):
                logger.error(f"Error logging failed login: {e}")
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Registrar intento exitoso (obtener user_id del token)
    from src.core.security import decode_token
    payload = decode_token(token.access_token)
    user_id = int(payload.get("sub"))
    
    # Limpiar intentos fallidos y registrar login exitoso (si la tabla existe)
    try:
        RateLimitService.reset_user_attempts(db=db, username_or_email=form_data.username)
        
        AuditService.log_action(
            db=db,
            user_id=user_id,
            action="login",
            ip_address=ip_address,
            user_agent=user_agent,
            status="success",
        )
        
        AuditService.log_login_attempt(
            db=db,
            username_or_email=form_data.username,
            ip_address=ip_address,
            success=True,
            user_agent=user_agent,
        )
    except Exception as e:
        if "relation" not in str(e):
            logger.error(f"Error logging successful login: {e}")
    
    
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
