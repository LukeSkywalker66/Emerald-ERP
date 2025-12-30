"""
Servicio de Audit Logging
"""
import json
import logging
from typing import Optional, Any, Dict

from sqlalchemy.orm import Session
from fastapi import Request

from src.models.audit import AuditLog, LoginAttempt


logger = logging.getLogger("Emerald.AuditService")


class AuditService:
    """Servicio para registrar todas las acciones importantes del sistema."""
    
    @staticmethod
    def log_action(
        db: Session,
        user_id: Optional[int],
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        ip_address: str = "0.0.0.0",
        user_agent: Optional[str] = None,
        status: str = "success",
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """Registra una acción en el audit log."""
        
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            details=json.dumps(details) if details else None,
            error_message=error_message,
        )
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        level = logging.INFO if status == "success" else logging.WARNING
        logger.log(
            level,
            f"[AUDIT] action={action}, user_id={user_id}, status={status}, ip={ip_address}"
        )
        
        return audit_log
    
    @staticmethod
    def log_login_attempt(
        db: Session,
        username_or_email: str,
        ip_address: str,
        success: bool,
        user_agent: Optional[str] = None,
    ) -> LoginAttempt:
        """Registra un intento de login."""
        
        login_attempt = LoginAttempt(
            username_or_email=username_or_email,
            ip_address=ip_address,
            success=success,
            user_agent=user_agent,
        )
        
        db.add(login_attempt)
        db.commit()
        db.refresh(login_attempt)
        
        status = "✅ éxito" if success else "❌ fallido"
        logger.info(f"[LOGIN_ATTEMPT] user={username_or_email}, ip={ip_address}, {status}")
        
        return login_attempt
    
    @staticmethod
    def get_audit_logs(
        db: Session,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ):
        """Obtiene audit logs con filtros opcionales."""
        
        query = db.query(AuditLog)
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        
        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "logs": [log.to_dict() for log in logs],
        }
    
    @staticmethod
    def get_login_attempts(
        db: Session,
        ip_address: Optional[str] = None,
        limit: int = 100,
    ):
        """Obtiene intentos de login recientes."""
        
        query = db.query(LoginAttempt)
        
        if ip_address:
            query = query.filter(LoginAttempt.ip_address == ip_address)
        
        attempts = query.order_by(LoginAttempt.created_at.desc()).limit(limit).all()
        
        return attempts


def get_client_ip(request: Request) -> str:
    """Extrae la IP del cliente de la request."""
    if x_forwarded_for := request.headers.get("x-forwarded-for"):
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"
