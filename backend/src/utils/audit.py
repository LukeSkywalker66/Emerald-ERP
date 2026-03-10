"""
Utilidades para Audit Logging

Funciones helper para registrar acciones de auditoría de forma consistente.
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, date
import enum

from src.models.audit import AuditLog, AuditAction
from src.models.user import User


def log_audit_action(
    db: Session,
    user_id: Optional[int],
    action: AuditAction,
    entity_name: str,
    entity_id: Optional[int] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    commit: bool = True
) -> AuditLog:
    """
    Registra una acción de auditoría en la base de datos.
    
    Args:
        db: Sesión de base de datos SQLAlchemy
        user_id: ID del usuario que ejecuta la acción (None para acciones del sistema)
        action: Tipo de acción (CREATE, UPDATE, DELETE, etc.)
        entity_name: Nombre de la entidad afectada (ej: "warehouses", "tickets")
        entity_id: ID del registro afectado (opcional)
        old_values: Valores anteriores del registro (para UPDATE)
        new_values: Valores nuevos del registro (para CREATE/UPDATE)
        ip_address: Dirección IP del cliente (opcional)
        user_agent: User-Agent del navegador (opcional)
        status: Estado de la operación ("success" o "failure")
        error_message: Mensaje de error si status="failure"
        commit: Si True, hace commit automático (usar False si es parte de transacción mayor)
    
    Returns:
        AuditLog: Registro de auditoría creado
    
    Ejemplos:
        # CREATE de un warehouse
        log_audit_action(
            db=db,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_name="warehouses",
            entity_id=warehouse.id,
            new_values={"name": "Almacén Central", "type": "CENTRAL"}
        )
        
        # UPDATE de un warehouse
        log_audit_action(
            db=db,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_name="warehouses",
            entity_id=warehouse.id,
            old_values={"name": "Almacén A"},
            new_values={"name": "Almacén Principal"}
        )
        
        # DELETE de un warehouse
        log_audit_action(
            db=db,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_name="warehouses",
            entity_id=warehouse.id,
            old_values={"name": "Almacén Obsoleto", "type": "VIRTUAL"}
        )
        
        # ACCESS_DENIED (intento de acceso no autorizado)
        log_audit_action(
            db=db,
            user_id=current_user.id,
            action=AuditAction.ACCESS_DENIED,
            entity_name="inventory_admin",
            status="failure",
            error_message="Técnico intentó acceder a vista administrativa",
            ip_address=request.client.host
        )
    """
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_name=entity_name,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        error_message=error_message
    )
    
    db.add(audit_log)
    
    if commit:
        try:
            db.commit()
            db.refresh(audit_log)
        except Exception as e:
            db.rollback()
            # En caso de error, intentar loggear el error en sí
            print(f"❌ Error al registrar audit log: {e}")
            raise
    
    return audit_log


def log_create(
    db: Session,
    user_id: Optional[int],
    entity_name: str,
    entity_id: int,
    new_values: Dict[str, Any],
    commit: bool = True
) -> AuditLog:
    """
    Helper rápido para registrar operaciones CREATE.
    
    Ejemplo:
        log_create(db, current_user.id, "warehouses", warehouse.id, {"name": "Almacén 1"})
    """
    return log_audit_action(
        db=db,
        user_id=user_id,
        action=AuditAction.CREATE,
        entity_name=entity_name,
        entity_id=entity_id,
        new_values=new_values,
        commit=commit
    )


def log_update(
    db: Session,
    user_id: Optional[int],
    entity_name: str,
    entity_id: int,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
    commit: bool = True
) -> AuditLog:
    """
    Helper rápido para registrar operaciones UPDATE.
    
    Ejemplo:
        log_update(
            db, current_user.id, "warehouses", warehouse.id,
            old_values={"name": "Almacén A"},
            new_values={"name": "Almacén Principal"}
        )
    """
    return log_audit_action(
        db=db,
        user_id=user_id,
        action=AuditAction.UPDATE,
        entity_name=entity_name,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        commit=commit
    )


def log_delete(
    db: Session,
    user_id: Optional[int],
    entity_name: str,
    entity_id: int,
    old_values: Dict[str, Any],
    commit: bool = True
) -> AuditLog:
    """
    Helper rápido para registrar operaciones DELETE.
    
    Ejemplo:
        log_delete(db, current_user.id, "warehouses", warehouse.id, {"name": "Almacén Obsoleto"})
    """
    return log_audit_action(
        db=db,
        user_id=user_id,
        action=AuditAction.DELETE,
        entity_name=entity_name,
        entity_id=entity_id,
        old_values=old_values,
        commit=commit
    )


def log_access_denied(
    db: Session,
    user_id: Optional[int],
    entity_name: str,
    entity_id: Optional[int] = None,
    error_message: str = "Acceso denegado",
    ip_address: Optional[str] = None,
    commit: bool = True
) -> AuditLog:
    """
    Helper rápido para registrar intentos de acceso denegado.
    
    Ejemplo:
        log_access_denied(
            db, technician.id, "inventory_admin",
            error_message="Técnico intentó acceder a vista administrativa",
            ip_address=request.client.host
        )
    """
    return log_audit_action(
        db=db,
        user_id=user_id,
        action=AuditAction.ACCESS_DENIED,
        entity_name=entity_name,
        entity_id=entity_id,
        status="failure",
        error_message=error_message,
        ip_address=ip_address,
        commit=commit
    )


def get_entity_dict(entity: Any, fields: Optional[list[str]] = None) -> Dict[str, Any]:
    """
    Convierte una entidad SQLAlchemy a diccionario JSON-serializable para auditoría.
    
    Maneja automáticamente:
    - datetime/date → ISO string
    - Enums → .value
    - Otros objetos → str()
    
    Args:
        entity: Instancia del modelo SQLAlchemy
        fields: Lista de campos a incluir (si None, incluye todos los campos no privados)
    
    Returns:
        Diccionario con los campos del modelo, JSON-serializable
    
    Ejemplo:
        old_values = get_entity_dict(warehouse, fields=["name", "type", "user_id"])
    """
    def serialize_value(value: Any) -> Any:
        """Convierte un valor a formato JSON-serializable."""
        if value is None:
            return None
        elif isinstance(value, (datetime, date)):
            return value.isoformat()
        elif isinstance(value, enum.Enum):
            return value.value
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, dict):
            return {k: serialize_value(v) for k, v in value.items()}
        elif isinstance(value, (list, tuple)):
            return [serialize_value(v) for v in value]
        else:
            # Para objetos complejos, usar str()
            return str(value)
    
    if fields:
        return {field: serialize_value(getattr(entity, field, None)) for field in fields}
    
    # Incluir todos los campos excepto los privados y relaciones
    result = {}
    for column in entity.__table__.columns:
        field_name = column.name
        if not field_name.startswith("_"):
            value = getattr(entity, field_name, None)
            result[field_name] = serialize_value(value)
    
    return result
