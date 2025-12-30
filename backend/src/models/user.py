"""
Modelos de autenticación y autorización (SQLAlchemy 2.0)
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    """
    Modelo de roles del sistema.
    
    Un rol define un conjunto de permisos que se pueden asignar a usuarios.
    """
    __tablename__ = "roles"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Nombre único del rol"
    )
    permissions: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
        comment="Lista de permisos en formato JSON"
    )
    
    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="role",
        lazy="select"
    )
    
    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}')>"


class User(Base, TimestampMixin):
    """
    Modelo de usuario del sistema.
    """
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Email del usuario"
    )
    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Nombre de usuario"
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Nombre completo"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Password hasheado con Argon2"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Usuario activo"
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Tiene permisos de superusuario"
    )
    
    # Foreign Keys
    role_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del rol asignado"
    )
    
    # Relationships
    role: Mapped[Optional["Role"]] = relationship(
        "Role",
        back_populates="users",
        lazy="joined"
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
    
    def has_permission(self, permission: str) -> bool:
        """Verifica si el usuario tiene un permiso específico."""
        if self.is_superuser:
            return True
        
        if not self.role or not self.role.permissions:
            return False
        
        return permission in self.role.permissions or "*" in self.role.permissions
