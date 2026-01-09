"""
Repositorio para operaciones de roles en BD
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from src.models import Role


class RoleRepository:
    """Repositorio para gestionar roles"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all(self) -> List[Role]:
        """
        Obtener todos los roles ordenados por nombre
        """
        return self.db.query(Role).order_by(Role.name).all()
    
    def get_by_id(self, role_id: int) -> Optional[Role]:
        """
        Obtener un rol por su ID
        """
        return self.db.query(Role).filter(Role.id == role_id).first()
    
    def get_by_name(self, name: str) -> Optional[Role]:
        """
        Obtener un rol por su nombre
        """
        return self.db.query(Role).filter(Role.name == name).first()
