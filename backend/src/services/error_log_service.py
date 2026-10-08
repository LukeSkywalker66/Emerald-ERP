"""
Servicio de registro de errores (best-effort).

`log_error` persiste en la tabla `error_logs` sin lanzar excepciones: si la
escritura falla (p. ej. DB caída), solo se emite un warning al logger estándar,
de modo que el flujo principal nunca se ve afectado por el logging.
"""
from __future__ import annotations

import logging
from typing import Optional

from src.database import SessionLocal
from src.models.error_log import ErrorLog

logger = logging.getLogger(__name__)


def log_error(
    *,
    level: str = "ERROR",
    source: str = "backend",
    module: Optional[str] = None,
    message: str = "",
    stack_trace: Optional[str] = None,
    user_id: Optional[int] = None,
    request_method: Optional[str] = None,
    request_path: Optional[str] = None,
    status_code: Optional[int] = None,
    context: Optional[dict] = None,
) -> None:
    """Registra un error en DB de forma best-effort (nunca rompe el flujo)."""
    try:
        db = SessionLocal()
        try:
            db.add(
                ErrorLog(
                    level=(level or "ERROR")[:20],
                    source=(source or "backend")[:20],
                    module=(module or None)[:120] if module else None,
                    message=(message or "")[:4000],
                    stack_trace=(stack_trace or None)[:20000] if stack_trace else None,
                    user_id=user_id,
                    request_method=(request_method or None)[:10] if request_method else None,
                    request_path=(request_path or None)[:255] if request_path else None,
                    status_code=status_code,
                    context=context,
                )
            )
            db.commit()
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"No se pudo persistir error_log: {exc}")
