"""
Esquemas Pydantic para Audit Logging

Schemas para consulta y creación de registros de auditoría.
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from src.models.audit import AuditAction


# ============================================
# SCHEMAS BASE
# ============================================

class AuditLogBase(BaseModel):
    """Schema base para AuditLog."""
    user_id: Optional[int] = Field(
        None,
        description="ID del usuario que ejecutó la acción (NULL para acciones del sistema)"
    )
    action: AuditAction = Field(
        ...,
        description="Tipo de acción ejecutada (CREATE, UPDATE, DELETE, etc.)"
    )
    entity_name: str = Field(
        ...,
        max_length=100,
        description="Nombre de la entidad afectada (warehouses, tickets, users, etc.)"
    )
    entity_id: Optional[int] = Field(
        None,
        description="ID del registro afectado en la tabla de la entidad"
    )
    old_values: Optional[Dict[str, Any]] = Field(
        None,
        description="Valores anteriores del registro (antes de la mutación)"
    )
    new_values: Optional[Dict[str, Any]] = Field(
        None,
        description="Valores nuevos del registro (después de la mutación)"
    )
    ip_address: Optional[str] = Field(
        None,
        max_length=45,
        description="Dirección IP del cliente"
    )
    user_agent: Optional[str] = Field(
        None,
        max_length=500,
        description="User-Agent del navegador/cliente"
    )
    status: Optional[str] = Field(
        "success",
        max_length=20,
        description="Estado de la operación (success, failure)"
    )
    error_message: Optional[str] = Field(
        None,
        max_length=500,
        description="Mensaje de error si la operación falló"
    )


# ============================================
# SCHEMAS DE CREACIÓN
# ============================================

class AuditLogCreate(AuditLogBase):
    """
    Schema para crear un nuevo registro de auditoría.
    
    Uso típico en función utilitaria:
    ```python
    log_audit_action(
        db,
        user_id=current_user.id,
        action=AuditAction.UPDATE,
        entity_name="warehouses",
        entity_id=warehouse.id,
        old_values={"name": "Almacén A", "type": "CENTRAL"},
        new_values={"name": "Almacén Principal", "type": "CENTRAL"}
    )
    ```
    """
    pass


# ============================================
# SCHEMAS DE RESPUESTA
# ============================================

class AuditLogResponse(AuditLogBase):
    """
    Schema de respuesta para AuditLog.
    Incluye campos de timestamp y relaciones calculadas.
    """
    id: int = Field(..., description="ID único del registro de auditoría")
    created_at: datetime = Field(..., description="Timestamp de creación del registro")
    updated_at: datetime = Field(..., description="Timestamp de última actualización")
    
    # Campos calculados (opcionales, se cargan bajo demanda)
    user_name: Optional[str] = Field(
        None,
        description="Nombre completo del usuario que ejecutó la acción (cargado desde relación)"
    )
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# SCHEMAS DE FILTRADO
# ============================================

class AuditLogFilter(BaseModel):
    """
    Schema para filtros de consulta de audit logs.
    
    Uso en endpoint:
    ```python
    GET /v2/audit-logs?action=DELETE&entity_name=warehouses&user_id=5&limit=50
    ```
    """
    user_id: Optional[int] = Field(None, description="Filtrar por usuario")
    action: Optional[AuditAction] = Field(None, description="Filtrar por tipo de acción")
    entity_name: Optional[str] = Field(None, description="Filtrar por entidad afectada")
    entity_id: Optional[int] = Field(None, description="Filtrar por ID de registro específico")
    status: Optional[str] = Field(None, description="Filtrar por estado (success/failure)")
    limit: int = Field(100, ge=1, le=500, description="Número máximo de registros a retornar")
    offset: int = Field(0, ge=0, description="Offset para paginación")


# ============================================
# SCHEMAS DE LISTA PAGINADA
# ============================================

class AuditLogListResponse(BaseModel):
    """
    Schema para respuesta paginada de audit logs.
    
    Respuesta típica:
    ```json
    {
        "items": [...],
        "total": 1532,
        "limit": 100,
        "offset": 0
    }
    ```
    """
    items: list[AuditLogResponse] = Field(..., description="Lista de registros de auditoría")
    total: int = Field(..., description="Total de registros que coinciden con los filtros")
    limit: int = Field(..., description="Límite de registros por página")
    offset: int = Field(..., description="Offset para paginación")
    
    model_config = ConfigDict(from_attributes=True)
