"""
Repositorio para operaciones de usuarios
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.user import User, Role
from .base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repositorio para gestión de usuarios."""
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Busca un usuario por email."""
        stmt = select(User).where(User.email == email)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_by_username(self, username: str) -> Optional[User]:
        """Busca un usuario por username."""
        stmt = select(User).where(User.username == username)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_active_users(self) -> list[User]:
        """Obtiene todos los usuarios activos."""
        stmt = select(User).where(User.is_active == True)
        result = self.db.execute(stmt)
        return list(result.scalars().all())
    
    def activate_user(self, user_id: int) -> Optional[User]:
        """Activa un usuario."""
        user = self.get(user_id)
        if user:
            user.is_active = True
            return self.update(user)
        return None
    
    def deactivate_user(self, user_id: int) -> Optional[User]:
        """Desactiva un usuario."""
        user = self.get(user_id)
        if user:
            user.is_active = False
            return self.update(user)
        return None


class RoleRepository(BaseRepository[Role]):
    """Repositorio para gestión de roles."""
    
    def __init__(self, db: Session):
        super().__init__(Role, db)
    
    def get_by_name(self, name: str) -> Optional[Role]:
        """Busca un rol por nombre."""
        stmt = select(Role).where(Role.name == name)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()
