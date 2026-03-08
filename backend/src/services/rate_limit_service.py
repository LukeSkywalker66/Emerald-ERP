"""
Servicio de Rate Limiting para prevenir ataques de fuerza bruta
"""
import logging
from datetime import datetime, timedelta
from typing import Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from src.models.audit import LoginAttempt
from src import config


logger = logging.getLogger("Emerald.RateLimitService")


class RateLimitService:
    """Servicio para controlar intentos de login y prevenir brute force attacks."""
    
    @staticmethod
    def get_max_attempts_per_user() -> int:
        """Obtiene el máximo de intentos fallidos por usuario desde configuración."""
        return config.RATE_LIMIT_MAX_ATTEMPTS_PER_USER
    
    @staticmethod
    def get_max_failed_attempts_per_ip_window() -> int:
        """Obtiene el máximo de fallos por IP para patrón de spray."""
        return config.RATE_LIMIT_MAX_FAILED_ATTEMPTS_PER_IP_WINDOW
    
    @staticmethod
    def get_max_distinct_users_per_ip_window() -> int:
        """Obtiene el máximo de usuarios distintos por IP para patrón de spray."""
        return config.RATE_LIMIT_MAX_DISTINCT_USERS_PER_IP_WINDOW
    
    @staticmethod
    def get_lockout_duration_minutes() -> int:
        """Obtiene la duración del lockout en minutos."""
        return config.RATE_LIMIT_LOCKOUT_DURATION_MINUTES

    @staticmethod
    def normalize_identifier(username_or_email: str) -> str:
        """Normaliza el identificador para evitar bypass por mayúsculas/espacios."""
        return (username_or_email or "").strip().lower()
    
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
        normalized_identifier = RateLimitService.normalize_identifier(username_or_email)
        now = datetime.utcnow()
        lockout_time = now - timedelta(minutes=RateLimitService.get_lockout_duration_minutes())
        
        # Verificar intentos fallidos por usuario
        user_attempts = db.query(LoginAttempt).filter(
            func.lower(LoginAttempt.username_or_email) == normalized_identifier,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        if user_attempts >= RateLimitService.get_max_attempts_per_user():
            logger.warning(
                f"[RATE_LIMIT] Usuario '{username_or_email}' bloqueado por demasiados intentos fallidos"
            )
            return False, f"Demasiados intentos fallidos. Intenta de nuevo en {RateLimitService.get_lockout_duration_minutes()} minutos."
        
        # Regla anti-spray por IP: solo bloquea si hay volumen alto y múltiples usuarios distintos.
        ip_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()

        ip_distinct_users = db.query(
            func.count(func.distinct(func.lower(LoginAttempt.username_or_email)))
        ).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).scalar() or 0
        
        if (
            ip_attempts >= RateLimitService.get_max_failed_attempts_per_ip_window()
            and ip_distinct_users >= RateLimitService.get_max_distinct_users_per_ip_window()
        ):
            logger.warning(
                f"[RATE_LIMIT] IP '{ip_address}' bloqueada por patrón de spray attack "
                f"(fails={ip_attempts}, users={ip_distinct_users})"
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
        normalized_identifier = RateLimitService.normalize_identifier(username_or_email)
        now = datetime.utcnow()
        lockout_time = now - timedelta(minutes=RateLimitService.get_lockout_duration_minutes())
        
        user_attempts = db.query(LoginAttempt).filter(
            func.lower(LoginAttempt.username_or_email) == normalized_identifier,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()
        
        ip_attempts = db.query(LoginAttempt).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).count()

        ip_distinct_users = db.query(
            func.count(func.distinct(func.lower(LoginAttempt.username_or_email)))
        ).filter(
            LoginAttempt.ip_address == ip_address,
            LoginAttempt.success == False,
            LoginAttempt.created_at >= lockout_time,
        ).scalar() or 0
        
        return {
            "user_failed_attempts": user_attempts,
            "ip_failed_attempts": ip_attempts,
            "ip_distinct_users": ip_distinct_users,
            "max_user_attempts": RateLimitService.get_max_attempts_per_user(),
            "max_failed_attempts_per_ip_window": RateLimitService.get_max_failed_attempts_per_ip_window(),
            "max_distinct_users_per_ip_window": RateLimitService.get_max_distinct_users_per_ip_window(),
            "lockout_minutes": RateLimitService.get_lockout_duration_minutes(),
        }
    
    @staticmethod
    def reset_user_attempts(
        db: Session,
        username_or_email: str,
    ) -> None:
        """Limpia los intentos fallidos para un usuario (después de login exitoso)."""
        normalized_identifier = RateLimitService.normalize_identifier(username_or_email)
        db.query(LoginAttempt).filter(
            func.lower(LoginAttempt.username_or_email) == normalized_identifier,
            LoginAttempt.success == False,
        ).delete()
        db.commit()
        logger.info(f"[RATE_LIMIT] Intentos fallidos limpiados para: {username_or_email}")
