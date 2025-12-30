"""
Schemas Pydantic para validación de usuarios
"""
from datetime import datetime
from typing import Optional
import re

from pydantic import BaseModel, Field, ConfigDict, field_validator


# --- Role Schemas ---

class RoleBase(BaseModel):
    """Schema base para roles"""
    name: str = Field(..., min_length=1, max_length=50)
    permissions: Optional[list[str]] = Field(default_factory=list)


class RoleCreate(RoleBase):
    """Schema para crear un rol"""
    pass


class RoleUpdate(BaseModel):
    """Schema para actualizar un rol"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    permissions: Optional[list[str]] = None


class RoleResponse(RoleBase):
    """Schema de respuesta para roles"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# --- User Schemas ---

class UserBase(BaseModel):
    """Schema base para usuarios"""
    email: str = Field(..., min_length=5, max_length=255)
    username: str = Field(..., min_length=3, max_length=100)
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validar formato de email básico"""
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, v):
            raise ValueError('Email inválido')
        return v.lower()


class UserLogin(BaseModel):
    """Schema para login de usuarios."""
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class UserCreate(UserBase):
    """Schema para crear un usuario"""
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    role_id: Optional[int] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Valida la complejidad del password."""
        if len(v) < 8:
            raise ValueError('El password debe tener al menos 8 caracteres')
        if not any(char.isupper() for char in v):
            raise ValueError('El password debe contener al menos una mayúscula')
        if not any(char.islower() for char in v):
            raise ValueError('El password debe contener al menos una minúscula')
        if not any(char.isdigit() for char in v):
            raise ValueError('El password debe contener al menos un número')
        return v


class UserUpdate(BaseModel):
    """Schema para actualizar un usuario"""
    email: Optional[str] = Field(None, min_length=5)
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    role_id: Optional[int] = None


class UserResponse(UserBase):
    """Schema de respuesta para usuarios (sin password)."""
    id: int
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    role_id: Optional[int]
    role: Optional[RoleResponse]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# --- Token Schemas ---

class Token(BaseModel):
    """Schema de respuesta para autenticación exitosa"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800  # 30 minutos en segundos


class TokenData(BaseModel):
    """Datos almacenados en el token JWT"""
    user_id: Optional[int] = None
    email: Optional[str] = None
