"""
Router para Audit Logging - Endpoints de consulta de registros de auditoría

Motor de Auditoría Universal - "Ojo de Dios"
Solo accesible para usuarios con rol 'admin'.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc, func

from src.database import get_db
from src.core.security import require_admin
from src.models.audit import AuditLog, AuditAction
from src.models.user import User
from src.schemas.audit import AuditLogResponse, AuditLogListResponse


router = APIRouter(tags=["Audit Logs"])


# ============================================
# ENDPOINTS
# ============================================

@router.get("", response_model=AuditLogListResponse)
def get_audit_logs(
    # Filtros
    user_id: Optional[int] = Query(None, description="Filtrar por ID de usuario"),
    action: Optional[AuditAction] = Query(None, description="Filtrar por tipo de acción"),
    entity_name: Optional[str] = Query(None, description="Filtrar por entidad afectada"),
    entity_id: Optional[int] = Query(None, description="Filtrar por ID de registro específico"),
    status_filter: Optional[str] = Query(None, description="Filtrar por estado (success/failure)"),
    
    # Paginación
    limit: int = Query(100, ge=1, le=500, description="Número máximo de registros a retornar"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
    
    # Autenticación y autorización (unificada desde security.py)
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener registros de auditoría con filtros opcionales.
    
    **Autenticación requerida:** JWT Token válido
    **Autorización requerida:** Rol 'admin'
    
    **Query Parameters:**
    - `user_id`: Filtrar por usuario que ejecutó la acción
    - `action`: Filtrar por tipo de acción (CREATE, UPDATE, DELETE, etc.)
    - `entity_name`: Filtrar por entidad afectada (warehouses, tickets, users, etc.)
    - `entity_id`: Filtrar por ID de registro específico
    - `status_filter`: Filtrar por estado (success, failure)
    - `limit`: Número máximo de registros (1-500, default: 100)
    - `offset`: Offset para paginación (default: 0)
    
    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1532,
                "user_id": 5,
                "action": "UPDATE",
                "entity_name": "warehouses",
                "entity_id": 42,
                "old_values": {"name": "Almacén A"},
                "new_values": {"name": "Almacén Principal"},
                "created_at": "2026-03-09T15:30:00Z",
                ...
            }
        ],
        "total": 1532,
        "limit": 100,
        "offset": 0
    }
    ```
    
    **Ejemplos de uso:**
    - Ver todos los DELETE: `GET /v2/audit-logs?action=DELETE`
    - Ver cambios en warehouse #42: `GET /v2/audit-logs?entity_name=warehouses&entity_id=42`
    - Ver acciones de usuario #5: `GET /v2/audit-logs?user_id=5`
    - Ver intentos de acceso denegado: `GET /v2/audit-logs?action=ACCESS_DENIED`
    """
    try:
        # Construir query con filtros
        stmt = select(AuditLog)
        
        filters = []
        if user_id is not None:
            filters.append(AuditLog.user_id == user_id)
        if action is not None:
            filters.append(AuditLog.action == action)
        if entity_name is not None:
            filters.append(AuditLog.entity_name == entity_name)
        if entity_id is not None:
            filters.append(AuditLog.entity_id == entity_id)
        if status_filter is not None:
            filters.append(AuditLog.status == status_filter)
        
        if filters:
            stmt = stmt.where(and_(*filters))
        
        # Ordenar por created_at descendente (más recientes primero)
        stmt = stmt.order_by(desc(AuditLog.created_at))
        
        # Contar total (sin paginación)
        count_stmt = select(func.count(AuditLog.id))
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total = db.scalar(count_stmt) or 0
        
        # Aplicar paginación
        stmt = stmt.limit(limit).offset(offset)
        
        # Ejecutar query
        audit_logs = db.execute(stmt).scalars().all()
        
        # Convertir a response schema
        items = [
            AuditLogResponse(
                **log.__dict__,
                user_name=(log.user.full_name or log.user.username) if log.user else None
            )
            for log in audit_logs
        ]
        
        return AuditLogListResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset
        )
        
    except HTTPException:
        # Re-raise HTTPException (403 de autorización)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar audit logs: {str(e)}"
        )


@router.get("/{audit_log_id}", response_model=AuditLogResponse)
def get_audit_log_by_id(
    audit_log_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener un registro de auditoría específico por ID.
    
    **Autenticación requerida:** JWT Token válido
    **Autorización requerida:** Rol 'admin'
    
    **Path Parameters:**
    - `audit_log_id`: ID del registro de auditoría
    
    **Response:** AuditLogResponse con todos los detalles del registro
    
    **Example:**
    ```
    GET /v2/audit-logs/1532
    ```
    """
    try:
        stmt = select(AuditLog).where(AuditLog.id == audit_log_id)
        audit_log = db.execute(stmt).scalar_one_or_none()
        
        if audit_log is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registro de auditoría con ID {audit_log_id} no encontrado"
            )
        
        return AuditLogResponse(
            **audit_log.__dict__,
            user_name=(audit_log.user.full_name or audit_log.user.username) if audit_log.user else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar audit log: {str(e)}"
        )
