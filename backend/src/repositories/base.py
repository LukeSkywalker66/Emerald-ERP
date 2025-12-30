"""
Repositorio base genérico para operaciones CRUD
"""
from typing import Generic, Type, TypeVar, Optional, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.base import Base


# Type variable para el modelo
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Repositorio base con operaciones CRUD genéricas.
    
    Implementa el patrón Repository para abstraer el acceso a datos.
    """
    
    def __init__(self, model: Type[ModelType], db: Session):
        """Inicializa el repositorio."""
        self.model = model
        self.db = db
    
    def get(self, id: int) -> Optional[ModelType]:
        """Obtiene un registro por ID."""
        return self.db.get(self.model, id)
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Obtiene todos los registros con paginación."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = self.db.execute(stmt)
        return list(result.scalars().all())
    
    def create(self, obj: ModelType) -> ModelType:
        """Crea un nuevo registro."""
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj
    
    def update(self, obj: ModelType) -> ModelType:
        """Actualiza un registro existente."""
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj
    
    def delete(self, id: int) -> bool:
        """Elimina un registro por ID."""
        obj = self.get(id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
            return True
        return False
    
    def count(self) -> int:
        """Cuenta la cantidad total de registros."""
        stmt = select(self.model)
        result = self.db.execute(stmt)
        return len(list(result.scalars().all()))
