"""
Settings Models - Configuración General del Sistema
Soporta almacenamiento key-value para configuraciones dinámicas
y monitores de servicio para control de estado de proveedores.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey,
    Enum, Boolean, Float, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base
from src.database.base import TimestampMixin


# ============================================
# ENUMS
# ============================================

class MonitorType(str, PyEnum):
    """Tipos de monitoreo soportados."""
    HTTP = "HTTP"          # Verificación HTTP/HTTPS
    PING = "PING"          # Ping ICMP
    TCP = "TCP"            # Conexión TCP puerto
    SSL = "SSL"            # Validación certificado SSL


class CriticalityIndex(int, PyEnum):
    """Índice de criticidad para monitores de servicio."""
    LOW = 1       # Verde - Servicio prescindible
    MEDIUM = 2    # Amarillo - Servicio importante
    HIGH = 3      # Naranja - Servicio crítico
    CRITICAL = 4  # Rojo - Servicio vital (afecta operación)
    MISSION_CRITICAL = 5  # Púrpura - Servicio misión crítica


class MonitorStatus(str, PyEnum):
    """Estado de un monitor de servicio."""
    UP = "UP"
    DOWN = "DOWN"
    UNKNOWN = "UNKNOWN"
    DEGRADED = "DEGRADED"


# ============================================
# MODELOS
# ============================================

class SystemConfig(Base, TimestampMixin):
    """
    Configuración general del sistema en formato key-value.
    
    Almacena configuraciones dinámicas como:
    - Nombre de la empresa
    - URL del logo
    - Horario laboral (mañana/tarde)
    - Zona horaria
    - Cualquier configuración futura sin necesidad de migraciones
    
    El campo `value` es JSONB para soportar cualquier tipo de dato.
    """
    __tablename__ = "system_config"
    
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Identificador único de la configuración (ej: company_name, work_hours)"
    )
    value: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Valor de la configuración en formato JSON flexible"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Descripción legible de para qué sirve esta configuración"
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="ID del usuario que actualizó por última vez"
    )
    
    # Relationships
    updater: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="joined"
    )
    
    def __repr__(self) -> str:
        return f"<SystemConfig(id={self.id}, key='{self.key}')>"


class ServiceMonitor(Base, TimestampMixin):
    """
    Monitores de Servicio — Puntos de control para verificar
    el estado de proveedores de servicios críticos.
    
    Cada monitor representa un endpoint (WAN, facturación, herramientas)
    que se verifica periódicamente para mostrar su estado en el Dashboard.
    
    Las credenciales se almacenan hasheadas usando el mismo mecanismo
    que APIKeyService (nunca en texto plano).
    """
    __tablename__ = "service_monitors"
    
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    label: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Etiqueta descriptiva del monitor (ej: 'WAN Principal', 'Sistema de Facturación')"
    )
    url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="URL o dirección del endpoint a monitorear"
    )
    monitor_type: Mapped[MonitorType] = mapped_column(
        Enum(MonitorType),
        nullable=False,
        default=MonitorType.HTTP,
        comment="Tipo de verificación (HTTP, PING, TCP, SSL)"
    )
    auth_username: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Nombre de usuario para autenticación (si requiere)"
    )
    auth_password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Contraseña hasheada con Argon2 (NUNCA texto plano)"
    )
    criticality_index: Mapped[CriticalityIndex] = mapped_column(
        Integer,
        nullable=False,
        default=CriticalityIndex.MEDIUM,
        comment="Índice de criticidad 1-5 (5 = misión crítica)"
    )
    alert_color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#EF4444",
        comment="Color hexadecimal para alerta en Dashboard (ej: #FF0000)"
    )
    check_interval_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=300,
        comment="Intervalo entre verificaciones en segundos (default: 5 min)"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Si está activo para monitoreo periódico"
    )
    last_status: Mapped[MonitorStatus] = mapped_column(
        Enum(MonitorStatus),
        nullable=False,
        default=MonitorStatus.UNKNOWN,
        comment="Último estado conocido (UP, DOWN, UNKNOWN, DEGRADED)"
    )
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp de la última verificación"
    )
    last_status_code: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Último código de estado HTTP (si aplica)"
    )
    last_error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Mensaje de error de la última verificación fallida"
    )
    response_time_ms: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Tiempo de respuesta de la última verificación en ms"
    )
    tags: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Etiquetas adicionales en formato JSON para categorización"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notas internas sobre este monitor"
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID del usuario que creó el monitor"
    )
    
    # Relationships
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined"
    )
    
    def __repr__(self) -> str:
        return (
            f"<ServiceMonitor(id={self.id}, label='{self.label}', "
            f"status='{self.last_status}', criticality={self.criticality_index})>"
        )
    
    @property
    def is_critical(self) -> bool:
        """Retorna True si el monitor es crítico o misión crítica."""
        return self.criticality_index >= CriticalityIndex.HIGH
    
    @property
    def status_color(self) -> str:
        """Retorna el color correspondiente al estado actual."""
        status_colors = {
            MonitorStatus.UP: "#22C55E",      # Verde
            MonitorStatus.DOWN: self.alert_color,  # Color configurado
            MonitorStatus.UNKNOWN: "#6B7280", # Gris
            MonitorStatus.DEGRADED: "#F59E0B", # Amarillo
        }
        return status_colors.get(self.last_status, "#6B7280")


# ============================================
# MONITOR CHECK HISTORY
# ============================================


class MonitorCheckHistory(Base, TimestampMixin):
    """
    Historial de verificaciones de monitores.
    
    Almacena el resultado de cada verificación (manual y automática)
    para análisis histórico, reportes de uptime y debugging.
    
    Esta tabla crece continuamente; se recomienda implementar
    una política de retención (TTL) para datos antiguos.
    """
    __tablename__ = "monitor_check_history"
    
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    monitor_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("service_monitors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID del monitor asociado"
    )
    status: Mapped[MonitorStatus] = mapped_column(
        Enum(MonitorStatus),
        nullable=False,
        comment="Estado al momento de la verificación"
    )
    status_code: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Código de estado (HTTP, exit code, etc.)"
    )
    response_time_ms: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Tiempo de respuesta en milisegundos"
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Mensaje de error si la verificación falló"
    )
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.now,
        index=True,
        comment="Timestamp de la verificación"
    )
    
    # Relationships
    monitor: Mapped["ServiceMonitor"] = relationship(
        "ServiceMonitor",
        backref="check_history",
        lazy="joined",
    )
    
    # Index para consultas rápidas por monitor + fecha
    __table_args__ = (
        Index(
            "ix_monitor_check_history_monitor_checked",
            "monitor_id", "checked_at",
        ),
    )
    
    def __repr__(self) -> str:
        return (
            f"<MonitorCheckHistory(id={self.id}, monitor_id={self.monitor_id}, "
            f"status='{self.status}', checked_at='{self.checked_at}')>"
        )
