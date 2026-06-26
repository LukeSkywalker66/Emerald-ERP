"""
Settings Schemas - Validación y serialización para configuración del sistema
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re

from src.models.settings import (
    MonitorType,
    CriticalityIndex,
    MonitorStatus
)


# ============================================
# SYSTEM CONFIG SCHEMAS
# ============================================

class SystemConfigCreate(BaseModel):
    """Schema para crear una configuración."""
    key: str = Field(
        ..., min_length=1, max_length=100,
        description="Identificador único (ej: company_name, work_hours)"
    )
    value: Any = Field(
        ..., description="Valor de la configuración (cualquier tipo JSON serializable)"
    )
    description: Optional[str] = Field(
        None, max_length=255,
        description="Descripción legible de la configuración"
    )


class SystemConfigUpdate(BaseModel):
    """Schema para actualizar una configuración."""
    value: Any = Field(
        ..., description="Nuevo valor de la configuración"
    )
    description: Optional[str] = Field(
        None, max_length=255,
        description="Nueva descripción (opcional)"
    )


class SystemConfigResponse(BaseModel):
    """Schema de respuesta para configuración."""
    id: int
    key: str
    value: Any
    description: Optional[str] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SystemConfigBulkUpdate(BaseModel):
    """Schema para actualizar múltiples configuraciones en batch."""
    settings: dict[str, Any] = Field(
        ...,
        description="Diccionario key:value con las configuraciones a actualizar"
    )


# ============================================
# WORK HOURS SCHEMA
# ============================================

class WorkHoursConfig(BaseModel):
    """Schema para horario laboral (validación de formato HH:MM)."""
    morning_start: str = Field(
        "08:00", pattern=r"^([01]\d|2[0-3]):([0-5]\d)$",
        description="Hora de inicio turno mañana (HH:MM)"
    )
    morning_end: str = Field(
        "13:00", pattern=r"^([01]\d|2[0-3]):([0-5]\d)$",
        description="Hora de fin turno mañana (HH:MM)"
    )
    afternoon_start: str = Field(
        "15:00", pattern=r"^([01]\d|2[0-3]):([0-5]\d)$",
        description="Hora de inicio turno tarde (HH:MM)"
    )
    afternoon_end: str = Field(
        "19:00", pattern=r"^([01]\d|2[0-3]):([0-5]\d)$",
        description="Hora de fin turno tarde (HH:MM)"
    )

    @field_validator("morning_end")
    @classmethod
    def validate_morning_end(cls, v, info):
        """Valida que morning_end > morning_start."""
        start = info.data.get("morning_start")
        if start and v <= start:
            raise ValueError("El fin de la mañana debe ser posterior al inicio")
        return v

    @field_validator("afternoon_end")
    @classmethod
    def validate_afternoon_end(cls, v, info):
        """Valida que afternoon_end > afternoon_start."""
        start = info.data.get("afternoon_start")
        if start and v <= start:
            raise ValueError("El fin de la tarde debe ser posterior al inicio")
        return v

    @field_validator("afternoon_start")
    @classmethod
    def validate_afternoon_after_morning(cls, v, info):
        """Valida que la tarde empiece después de que termina la mañana."""
        morning_end = info.data.get("morning_end")
        if morning_end and v <= morning_end:
            raise ValueError("El turno tarde debe comenzar después del turno mañana")
        return v


# ============================================
# SERVICE MONITOR SCHEMAS
# ============================================

class ServiceMonitorCreate(BaseModel):
    """Schema para crear un monitor de servicio."""
    label: str = Field(
        ..., min_length=1, max_length=150,
        description="Etiqueta descriptiva del monitor"
    )
    url: str = Field(
        ..., min_length=1, max_length=500,
        description="URL o dirección del endpoint a monitorear"
    )
    monitor_type: MonitorType = Field(
        default=MonitorType.HTTP,
        description="Tipo de verificación"
    )
    auth_username: Optional[str] = Field(
        None, max_length=100,
        description="Usuario para autenticación (si requiere)"
    )
    auth_password: Optional[str] = Field(
        None, max_length=255,
        description="Contraseña en texto plano (se hasheará al almacenar)"
    )
    criticality_index: CriticalityIndex = Field(
        default=CriticalityIndex.MEDIUM,
        description="Índice de criticidad 1-5"
    )
    alert_color: str = Field(
        default="#EF4444",
        description="Color hexadecimal para alerta (ej: #FF0000)"
    )
    check_interval_seconds: int = Field(
        default=300, ge=30, le=86400,
        description="Intervalo entre verificaciones en segundos (min: 30s, max: 24h)"
    )
    is_active: bool = Field(
        default=True,
        description="Activo para monitoreo periódico"
    )
    tags: Optional[dict] = Field(
        default=None,
        description="Etiquetas adicionales en formato JSON"
    )
    notes: Optional[str] = Field(
        None,
        description="Notas internas sobre este monitor"
    )

    @field_validator("alert_color")
    @classmethod
    def validate_color(cls, v):
        """Valida formato hexadecimal de color."""
        if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("El color debe ser hexadecimal (ej: #FF0000)")
        return v.upper()


class ServiceMonitorUpdate(BaseModel):
    """Schema para actualizar un monitor de servicio."""
    label: Optional[str] = Field(None, min_length=1, max_length=150)
    url: Optional[str] = Field(None, min_length=1, max_length=500)
    monitor_type: Optional[MonitorType] = None
    auth_username: Optional[str] = Field(None, max_length=100)
    auth_password: Optional[str] = Field(None, max_length=255)
    criticality_index: Optional[CriticalityIndex] = None
    alert_color: Optional[str] = Field(None, description="Color hexadecimal")
    check_interval_seconds: Optional[int] = Field(None, ge=30, le=86400)
    is_active: Optional[bool] = None
    tags: Optional[dict] = None
    notes: Optional[str] = None

    @field_validator("alert_color")
    @classmethod
    def validate_color(cls, v):
        if v is None:
            return v
        if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("El color debe ser hexadecimal (ej: #FF0000)")
        return v.upper()


class ServiceMonitorResponse(BaseModel):
    """Schema de respuesta para monitor de servicio."""
    id: int
    label: str
    url: str
    monitor_type: MonitorType
    auth_username: Optional[str] = None
    criticality_index: CriticalityIndex
    alert_color: str
    check_interval_seconds: int
    is_active: bool
    last_status: MonitorStatus
    last_checked_at: Optional[datetime] = None
    last_status_code: Optional[int] = None
    last_error_message: Optional[str] = None
    response_time_ms: Optional[float] = None
    tags: Optional[dict] = None
    notes: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    # Propiedades computadas
    is_critical: bool = Field(
        default=False,
        description="Calculado: True si criticality_index >= 3"
    )
    status_color: str = Field(
        default="#6B7280",
        description="Calculado: color según estado actual"
    )
    
    model_config = ConfigDict(from_attributes=True)


class ServiceMonitorListResponse(BaseModel):
    """Schema de respuesta para listado de monitores."""
    items: List[ServiceMonitorResponse]
    total: int
    active_count: int
    down_count: int


# ============================================
# MONITOR CHECK RESPONSE
# ============================================

class MonitorCheckResult(BaseModel):
    """Resultado de una verificación manual de monitor."""
    monitor_id: int
    label: str
    status: MonitorStatus
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    checked_at: datetime


# ============================================
# SYSTEM VERSION SCHEMA
# ============================================

class SystemVersionResponse(BaseModel):
    """Versión y entorno activos del sistema."""
    version: str
    environment: str


# ============================================
# SYNC STATUS SCHEMAS (para Tareas Programadas)
# ============================================

class SyncTaskInfo(BaseModel):
    """Información de una tarea programada (desde Celery Beat)."""
    task_name: str
    schedule: str
    description: str
    last_run: Optional[datetime] = None
    last_status: Optional[str] = None
    next_run: Optional[datetime] = None
    is_active: bool


class SyncExecutionHistoryItem(BaseModel):
    """Historial de ejecución de una tarea programada."""
    id: int
    task_name: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str  # running, success, failed
    details: Optional[dict] = None
    error_message: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class SyncExecutionHistoryResponse(BaseModel):
    """Respuesta con historial de ejecuciones."""
    items: List[SyncExecutionHistoryItem]
    total: int


# ============================================
# BACKUP SCHEMAS
# ============================================

from src.models.settings import BackupStatus, BackupTrigger  # noqa: E402


class BackupConfigUpdate(BaseModel):
    """Schema para actualizar la configuración de backup."""
    is_enabled: Optional[bool] = None
    cron_expression: Optional[str] = Field(
        None, max_length=50,
        description="Expresión cron (ej: '0 2 * * *' = 2:00 AM diario)"
    )
    drive_remote_name: Optional[str] = Field(None, max_length=100)
    drive_folder_id: Optional[str] = Field(None, max_length=200)
    retention_days: Optional[int] = Field(None, ge=1, le=365)
    backup_dir: Optional[str] = Field(None, max_length=255)
    lan_backup_enabled: Optional[bool] = None
    lan_server_ip: Optional[str] = Field(None, max_length=45)
    lan_server_user: Optional[str] = Field(None, max_length=100)
    lan_dest_folder: Optional[str] = Field(None, max_length=255)
    lan_ssh_key_path: Optional[str] = Field(None, max_length=255)
    include_minio_backup: Optional[bool] = None
    minio_bucket: Optional[str] = Field(None, max_length=100)


class BackupConfigResponse(BaseModel):
    """Schema de respuesta para la configuración de backup."""
    id: int
    is_enabled: bool
    cron_expression: str
    drive_remote_name: str
    drive_folder_id: str
    retention_days: int
    backup_dir: str
    lan_backup_enabled: bool
    lan_server_ip: Optional[str] = None
    lan_server_user: Optional[str] = None
    lan_dest_folder: Optional[str] = None
    lan_ssh_key_path: Optional[str] = None
    include_minio_backup: bool
    minio_bucket: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BackupRunResponse(BaseModel):
    """Schema de respuesta para una ejecución de backup."""
    id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: BackupStatus
    filename: Optional[str] = None
    size_bytes: Optional[int] = None
    log_output: Optional[str] = None
    error_message: Optional[str] = None
    triggered_by: BackupTrigger
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BackupRunListResponse(BaseModel):
    """Respuesta con historial de ejecuciones de backup."""
    items: List[BackupRunResponse]
    total: int
