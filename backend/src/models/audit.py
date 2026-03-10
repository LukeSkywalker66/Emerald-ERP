"""
Modelos para Audit Logging (SQLAlchemy 2.0)

Motor de Auditoría Universal - "Ojo de Dios"
Registra todas las mutaciones críticas del sistema para trazabilidad completa.
"""
from typing import Optional
from datetime import datetime

from sqlalchemy import Integer, String, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from src.database.base import Base, TimestampMixin


class AuditAction(str, enum.Enum):
    """Enum para acciones auditables."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    ACCESS_DENIED = "ACCESS_DENIED"
    EXPORT = "EXPORT"
    IMPORT = "IMPORT"


class AuditLog(Base, TimestampMixin):
    """
    Registro de auditoría para todas las acciones críticas del sistema.
    
    Arquitectura de 3 capas:
    - Capa 1: Acción + Usuario (Quién hizo qué)
    - Capa 2: Entidad + ID (Sobre qué entidad)
    - Capa 3: Valores antiguos/nuevos (Qué cambió exactamente)
    
    Casos de uso:
    - Rollback de cambios erróneos
    - Investigación de incidentes operativos
    - Cumplimiento normativo (compliance)
    - Detección de fraude interno
    """
    
    __tablename__ = "audit_logs"
    
    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # Capa 1: Acción + Usuario
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del usuario que ejecutó la acción (NULL para acciones del sistema)"
    )
    action: Mapped[str] = mapped_column(
        SQLEnum(AuditAction, name="audit_action_enum", create_type=True),
        nullable=False,
        index=True,
        comment="Tipo de acción ejecutada (CREATE, UPDATE, DELETE, etc.)"
    )
    
    # Capa 2: Entidad afectada
    entity_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Nombre de la entidad afectada (warehouses, tickets, users, etc.)"
    )
    entity_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="ID del registro afectado en la tabla de la entidad"
    )
    
    # Capa 3: Cambios detallados
    old_values: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Valores anteriores del registro (antes de la mutación)"
    )
    new_values: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Valores nuevos del registro (después de la mutación)"
    )
    
    # Contexto adicional (legacy fields - mantener compatibilidad)
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
        comment="Dirección IP del cliente (IPv4/IPv6)"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="User-Agent del navegador/cliente"
    )
    status: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        default="success",
        comment="Estado de la operación (success, failure)"
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Mensaje de error si la operación falló"
    )
    
    # Relationship (lazy para evitar cargas innecesarias)
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select"
    )
    
    def __repr__(self) -> str:
        return (
            f"<AuditLog(id={self.id}, user_id={self.user_id}, "
            f"action={self.action}, entity={self.entity_name}:{self.entity_id})>"
        )


class LoginAttempt(Base, TimestampMixin):
    """
    Registro de intentos de login para rate limiting y detección de fraude.
    
    Casos de uso:
    - Rate limiting (bloqueo temporal tras N intentos fallidos)
    - Detección de ataques de fuerza bruta
    - Análisis de patrones de acceso sospechosos
    """
    
    __tablename__ = "login_attempts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username_or_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Username o email usado en el intento de login"
    )
    ip_address: Mapped[str] = mapped_column(
        String(45),
        nullable=False,
        index=True,
        comment="Dirección IP del intento de login"
    )
    success: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        index=True,
        comment="True si el login fue exitoso, False si falló"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="User-Agent del cliente"
    )
    
    def __repr__(self) -> str:
        return (
            f"<LoginAttempt(username={self.username_or_email}, "
            f"ip={self.ip_address}, success={self.success})>"
        )
