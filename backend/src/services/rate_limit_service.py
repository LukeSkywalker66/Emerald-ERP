"""
Servicio de Rate Limiting para prevenir ataques de fuerza bruta
"""
import logging
from datetime import datetime, timedelta
from typing import Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from src.models.audit import LoginAttempt


logger = logging.getLogger("Emerald.RateLimitService")


class RateLimitService:
    """Servicio para controlar intentos de login y prevenir brute force attacks."""
    
    # Configuración de rate limiting
    MAX_ATTEMPTS_PER_IP = 5  # Máximo 5 intentos por IP
    MAX_ATTEMPTS_PER_USER = 3  # Máximo 3 intentos por usuario
    LOCKOUT_DURATION_MINUTES = 15  # Bloqueo por 15 minutos
    
    @staticmethod
    def check_rate_limit(
        db: Session,
        username_or_email: str,
        ip_address: str,
    ) -> Tuple[bool, str]:
        """
        Verifica si el login debe ser bloqueado por rate limiting.
        
        Retorna: (is_allowed, message)
        """
        now = datetime.utcnow()
        lockout_time = now - timedelta(minutes=RateLimitService.LOCKOUT_DURATION_MINUTES)
        
        # Verificar intentos fallidos por usuario
        user_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.username_or_email == username_or_email,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        if user_attempts >= RateLimitService.MAX_ATTEMPTS_PER_USER:
            logger.warning(
                f"[RATE_LIMIT] Usuario '{username_or_email}' bloqueado por demasiados intentos fallidos"
            )
            return False, f"Demasiados intentos fallidos. Intenta de nuevo en {RateLimitService.LOCKOUT_DURATION_MINUTES} minutos."
        
        # Verificar intentos fallidos por IP
        ip_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        if ip_attempts >= RateLimitService.MAX_ATTEMPTS_PER_IP:
            logger.warning(
                f"[RATE_LIMIT] IP '{ip_address}' bloqueada por demasiados intentos fallidos"
            )
            return False, "Demasiados intentos fallidos desde tu IP. Intenta de nuevo más tarde."
        
        return True, ""
    
    @staticmethod
    def get_failed_attempts_count(
        db: Session,
        username_or_email: str,
        ip_address: str,
    ) -> dict:
        """Retorna el conteo actual de intentos fallidos."""
        now = datetime.utcnow()
        lockout_time = now - timedelta(minutes=RateLimitService.LOCKOUT_DURATION_MINUTES)
        
        user_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.username_or_email == username_or_email,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        ip_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        return {
            "user_failed_attempts": user_attempts,
            "ip_failed_attempts": ip_attempts,
            "max_user_attempts": RateLimitService.MAX_ATTEMPTS_PER_USER,
            "max_ip_attempts": RateLimitService.MAX_ATTEMPTS_PER_IP,
            "lockout_minutes": RateLimitService.LOCKOUT_DURATION_MINUTES,
        }
    
    @staticmethod
    def reset_user_attempts(
        db: Session,
        username_or_email: str,
    ) -> None:
        """Limpia los intentos fallidos para un usuario (después de login exitoso)."""
        db.query(LoginAttempt).filter(
            LoginAttempt.username_or_email == username_or_email,
            LoginAttempt.success == False,
        ).delete()
        db.commit()
        logger.info(f"[RATE_LIMIT] Intentos fallidos limpiados para: {username_or_email}")
