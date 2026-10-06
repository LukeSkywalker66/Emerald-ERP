"""
Router de registro de errores.

- POST /api/v2/error-logs : reporta un error (público, usado por el frontend).
- GET  /api/v2/error-logs : consulta de errores (solo admin / capability *).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user, user_can
from src.models.error_log import ErrorLog
from src.models.user import User
from src.schemas.error_log import ErrorLogCreate, ErrorLogResponse, ErrorLogListResponse
from src.services.error_log_service import log_error

router = APIRouter(prefix="/api/v2/error-logs", tags=["ErrorLogs"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_error_log(
    payload: ErrorLogCreate,
    request: Request,
):
    """Registra un error reportado por el frontend (best-effort, público)."""
    # Si el request viene autenticado, asociar el usuario automáticamente.
    user_id = payload.user_id or getattr(request.state, "user_id", None)
    try:
        user_id = int(user_id) if user_id is not None else None
    except (TypeError, ValueError):
        user_id = None

    log_error(
        level=payload.level,
        source=payload.source or "frontend",
        module=payload.module,
        message=payload.message,
        stack_trace=payload.stack_trace,
        user_id=user_id,
        request_method=payload.request_method or request.method,
        request_path=payload.request_path or request.url.path,
        status_code=payload.status_code,
        context=payload.context,
    )
    return {"ok": True}


@router.get("", response_model=ErrorLogListResponse)
def list_error_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    source: Optional[str] = Query(None, description="backend | frontend"),
    level: Optional[str] = Query(None, description="ERROR | WARN | INFO"),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, description="Filtra por message"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Consulta errores registrados. Solo admin (capability `*` o `audit_logs.view`)."""
    if not user_can(current_user, "audit_logs.view"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver el registro de errores",
        )

    stmt = db.query(ErrorLog)
    if source:
        stmt = stmt.filter(ErrorLog.source == source)
    if level:
        stmt = stmt.filter(ErrorLog.level == level)
    if user_id:
        stmt = stmt.filter(ErrorLog.user_id == user_id)
    if search:
        stmt = stmt.filter(ErrorLog.message.ilike(f"%{search}%"))

    total = stmt.count()
    rows = (
        stmt.order_by(desc(ErrorLog.id))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return ErrorLogListResponse(
        items=[ErrorLogResponse.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
