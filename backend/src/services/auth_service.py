"""
Servicio de autenticación y autorización
"""
import logging
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from src.models.user import User
from src.repositories.user_repository import UserRepository
from src.schemas.user_schemas import UserCreate, Token
from src.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
)


logger = logging.getLogger("Emerald.AuthService")


class AuthService:
    """Servicio para gestión de autenticación y autorización."""
    
    def __init__(self, user_repository: UserRepository, session: Session):
        self.user_repo = user_repository
        self.session = session
    
    def authenticate_user(self, email_or_username: str, password: str) -> Optional[User]:
        """Autentica un usuario por email, username y password."""
        # Intentar primero por email
        user = self.user_repo.get_by_email(email_or_username)
        
        # Si no encuentra por email, intentar por username
        if not user:
            user = self.user_repo.get_by_username(email_or_username)
        
        if not user:
            logger.warning(f"Login fallido: usuario '{email_or_username}' no existe")
            return None
        
        if not verify_password(password, user.hashed_password):
            logger.warning(f"Login fallido: password incorrecta para '{email_or_username}'")
            return None
        
        if not user.is_active:
            logger.warning(f"Login fallido: usuario '{email_or_username}' está inactivo")
            return None
        
        logger.info(f"✅ Login exitoso: {user.username} ({user.email})")
        return user
    
    def login(
        self,
        email: str,  # Puede ser email o username
        password: str,
        expires_delta: Optional[timedelta] = None
    ) -> Optional[Token]:
        """Realiza login de usuario y genera token JWT."""
        user = self.authenticate_user(email, password)
        
        if not user:
            return None
        
        if expires_delta is None:
            expires_delta = timedelta(minutes=30)
        
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "username": user.username,
                "is_superuser": user.is_superuser,
            },
            expires_delta=expires_delta
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=int(expires_delta.total_seconds())
        )
    
    def register_user(self, user_create: UserCreate) -> User:
        """Registra un nuevo usuario en el sistema."""
        # Verificar que el email no exista
        existing_user = self.user_repo.get_by_email(user_create.email)
        if existing_user:
            logger.warning(f"Intento de registro con email duplicado: {user_create.email}")
            raise ValueError(f"El email '{user_create.email}' ya está registrado")
        
        # Verificar que el username no exista
        existing_user = self.user_repo.get_by_username(user_create.username)
        if existing_user:
            logger.warning(f"Intento de registro con username duplicado: {user_create.username}")
            raise ValueError(f"El username '{user_create.username}' ya está en uso")
        
        # Hashear password
        hashed_password = get_password_hash(user_create.password)
        
        # Crear usuario
        user = User(
            email=user_create.email,
            username=user_create.username,
            hashed_password=hashed_password,
            full_name=user_create.full_name,
            is_active=True,
            is_superuser=False,
            role_id=user_create.role_id
        )
        
        created_user = self.user_repo.create(user)
        
        logger.info(f"✅ Usuario registrado: {created_user.username} (ID: {created_user.id})")
        
        return created_user
    
    def change_password(
        self,
        user_id: int,
        old_password: str,
        new_password: str
    ) -> bool:
        """Cambia el password de un usuario."""
        user = self.user_repo.get(user_id)
        
        if not user:
            raise ValueError(f"Usuario {user_id} no encontrado")
        
        if not verify_password(old_password, user.hashed_password):
            logger.warning(f"Intento de cambio de password con contraseña incorrecta: {user.email}")
            raise ValueError("Password actual incorrecto")
        
        user.hashed_password = get_password_hash(new_password)
        self.user_repo.update(user)
        
        logger.info(f"✅ Password cambiado para: {user.username}")
        
        return True
