"""
Router de administración - Endpoints para tareas administrativas
Restringe acceso a usuarios con rol 'admin' o 'superuser'
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.database import get_db
from src.core.security import require_admin
from src.models.user import User
from src.models.audit import LoginAttempt
from src.services.rate_limit_service import RateLimitService

logger = logging.getLogger("Emerald.AdminRouter")

router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)




@router.post("/unlock-user")
def unlock_user(
    username_or_email: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Desbloquea los intentos fallidos de un usuario.
    
    **Permisos:** Solo administrador
    
    **Parámetros:**
    - `username_or_email`: Email o username del usuario a desbloquear
    
    **Respuesta:**
    - `success`: True si se desbloqueó
    - `message`: Descripción de la acción
    - `cleared_attempts`: Cantidad de intentos fallidos que se eliminaron
    """
    normalized_identifier = RateLimitService.normalize_identifier(username_or_email)
    
    # Contar intentos fallidos antes de limpiar
    cleared_attempts = db.query(LoginAttempt).filter(
        and_(
            func.lower(LoginAttempt.username_or_email) == normalized_identifier,
            LoginAttempt.success == False,
        )
    ).count()
    
    # Limpiar intentos fallidos
    RateLimitService.reset_user_attempts(db, username_or_email)
    
    logger.info(
        f"[ADMIN] Usuario {admin_user.username} desbloqueó a {username_or_email} "
        f"(eliminados {cleared_attempts} intentos fallidos)"
    )
    
    return {
        "success": True,
        "message": f"Usuario '{username_or_email}' desbloqueado exitosamente",
        "cleared_attempts": cleared_attempts,
    }


@router.post("/unlock-ip")
def unlock_ip(
    ip_address: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Desbloquea todos los intentos fallidos desde una IP específica.
    
    **Permisos:** Solo administrador
    
    **Parámetros:**
    - `ip_address`: IP a desbloquear (ej: "192.168.1.1")
    
    **Respuesta:**
    - `success`: True si se desbloqueó
    - `message`: Descripción de la acción
    - `cleared_attempts`: Cantidad de intentos fallidos eliminados desde esa IP
    """
    # Contar intentos fallidos antes de limpiar
    cleared_attempts = db.query(LoginAttempt).filter(
        and_(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
        )
    ).count()
    
    # Limpiar intentos fallidos de esa IP (solo los fallidos)
    db.query(LoginAttempt).filter(
        and_(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
        )
    ).delete()
    db.commit()
    
    logger.info(
        f"[ADMIN] Usuario {admin_user.username} desbloqueó IP {ip_address} "
        f"(eliminados {cleared_attempts} intentos fallidos)"
    )
    
    return {
        "success": True,
        "message": f"IP '{ip_address}' desbloqueada exitosamente",
        "cleared_attempts": cleared_attempts,
    }


@router.get("/rate-limit-config")
def get_rate_limit_config(
    admin_user: User = Depends(require_admin),
):
    """
    Obtiene la configuración actual de rate limiting.
    
    **Permisos:** Solo administrador
    
    **Respuesta:**
    - `max_user_attempts`: Máximo de intentos fallidos por usuario
    - `max_failed_attempts_per_ip_window`: Máximo de fallos por IP para patrón spray
    - `max_distinct_users_per_ip_window`: Máximo de usuarios distintos por IP para patrón spray
    - `lockout_minutes`: Duración del lockout en minutos
    """
    return {
        "max_user_attempts": RateLimitService.get_max_attempts_per_user(),
        "max_failed_attempts_per_ip_window": RateLimitService.get_max_failed_attempts_per_ip_window(),
        "max_distinct_users_per_ip_window": RateLimitService.get_max_distinct_users_per_ip_window(),
        "lockout_minutes": RateLimitService.get_lockout_duration_minutes(),
        "note": "Estos valores se cargan desde variables de entorno. Para cambiarlos, actualizar .env y reiniciar.",
    }


@router.get("/login-attempts/{username_or_email}")
def get_login_attempts(
    username_or_email: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Obtiene el historial de intentos de login recientes (últimos 15 minutos) para un usuario.
    
    **Permisos:** Solo administrador
    
    **Parámetros:**
    - `username_or_email`: Email o username a consultar
    
    **Respuesta:**
    - `user`: Username/email consultado
    - `current_attempts`: Datos del RateLimitService
    - `recent_history`: Últimos 10 intentos de login
    """
    normalized_identifier = RateLimitService.normalize_identifier(username_or_email)
    
    # Obtener conteo actual de intentos
    current_attempts = RateLimitService.get_failed_attempts_count(
        db, username_or_email, "0.0.0.0"  # IP dummy para el conteo de usuario
    )
    
    # Obtener historial reciente
    lockout_time = datetime.utcnow() - timedelta(minutes=60)  # últimas 60 minutos
    recent_attempts = db.query(LoginAttempt).filter(
        and_(
            func.lower(LoginAttempt.username_or_email) == normalized_identifier,
            LoginAttempt.created_at >= lockout_time,
        )
    ).order_by(LoginAttempt.created_at.desc()).limit(20).all()
    
    return {
        "user": username_or_email,
        "current_attempts": current_attempts,
        "recent_history": [
            {
                "timestamp": attempt.created_at.isoformat(),
                "ip_address": attempt.ip_address,
                "success": attempt.success,
            }
            for attempt in recent_attempts
        ],
    }
