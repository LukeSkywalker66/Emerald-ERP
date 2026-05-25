"""
Settings Service - Lógica de negocio para configuración del sistema
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional, List, Any

from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, and_

from src import models
from src.models.settings import (
    SystemConfig,
    ServiceMonitor,
    MonitorCheckHistory,
    MonitorType,
    MonitorStatus,
    CriticalityIndex,
)
from src.schemas.settings import (
    SystemConfigCreate,
    SystemConfigUpdate,
    ServiceMonitorCreate,
    ServiceMonitorUpdate,
    MonitorCheckResult,
)

logger = logging.getLogger("Emerald.SettingsService")

# Contexto de hash para contraseñas de monitores (bcrypt, igual que APIKeyService)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================
# SYSTEM CONFIG SERVICE
# ============================================

class SystemConfigService:
    """Servicio para gestionar configuraciones generales del sistema."""

    @staticmethod
    def get_all(db: Session) -> list[SystemConfig]:
        """Obtener todas las configuraciones."""
        stmt = select(SystemConfig).order_by(SystemConfig.key)
        result = db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def get_by_key(db: Session, key: str) -> Optional[SystemConfig]:
        """Obtener una configuración por su key."""
        stmt = select(SystemConfig).where(SystemConfig.key == key)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def get_value(db: Session, key: str, default: Any = None) -> Any:
        """
        Obtener el valor de una configuración directamente.
        Retorna `default` si la key no existe.
        """
        config = SystemConfigService.get_by_key(db, key)
        if config is None:
            return default
        return config.value

    @staticmethod
    def upsert(
        db: Session,
        key: str,
        value: Any,
        description: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> SystemConfig:
        """
        Crear o actualizar una configuración.
        Si la key existe, actualiza el valor. Si no, la crea.
        """
        existing = SystemConfigService.get_by_key(db, key)
        
        if existing:
            existing.value = value
            if description is not None:
                existing.description = description
            existing.updated_by = user_id
        else:
            existing = SystemConfig(
                key=key,
                value=value,
                description=description,
                updated_by=user_id,
            )
            db.add(existing)
        
        db.commit()
        db.refresh(existing)
        logger.info(f"[SETTINGS] Config '{key}' actualizada por user_id={user_id}")
        return existing

    @staticmethod
    def bulk_update(
        db: Session,
        settings: dict[str, Any],
        user_id: Optional[int] = None,
    ) -> list[SystemConfig]:
        """
        Actualizar múltiples configuraciones en batch.
        Crea las que no existen, actualiza las existentes.
        """
        results = []
        for key, value in settings.items():
            config = SystemConfigService.upsert(db, key, value, user_id=user_id)
            results.append(config)
        return results

    @staticmethod
    def delete(db: Session, key: str) -> bool:
        """Eliminar una configuración por su key. Retorna True si existía."""
        config = SystemConfigService.get_by_key(db, key)
        if config is None:
            return False
        db.delete(config)
        db.commit()
        logger.info(f"[SETTINGS] Config '{key}' eliminada")
        return True


# ============================================
# SERVICE MONITOR SERVICE
# ============================================

class ServiceMonitorService:
    """Servicio para gestionar monitores de servicio."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hashea una contraseña con bcrypt para almacenamiento seguro."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifica una contraseña contra su hash."""
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    @staticmethod
    def get_all(
        db: Session,
        active_only: bool = False,
        criticality_min: Optional[int] = None,
    ) -> list[ServiceMonitor]:
        """Obtener todos los monitores de servicio."""
        stmt = select(ServiceMonitor).order_by(
            ServiceMonitor.criticality_index.desc(),
            ServiceMonitor.label
        )
        
        if active_only:
            stmt = stmt.where(ServiceMonitor.is_active == True)
        
        if criticality_min is not None:
            stmt = stmt.where(ServiceMonitor.criticality_index >= criticality_min)
        
        result = db.execute(stmt)
        monitors = list(result.scalars().all())
        
        return monitors

    @staticmethod
    def get_by_id(db: Session, monitor_id: int) -> Optional[ServiceMonitor]:
        """Obtener un monitor por su ID."""
        stmt = select(ServiceMonitor).where(ServiceMonitor.id == monitor_id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def create(
        db: Session,
        data: ServiceMonitorCreate,
        user_id: Optional[int] = None,
    ) -> ServiceMonitor:
        """Crear un nuevo monitor de servicio."""
        auth_password_hash = None
        if data.auth_password:
            auth_password_hash = ServiceMonitorService.hash_password(data.auth_password)
        
        monitor = ServiceMonitor(
            label=data.label,
            url=data.url,
            monitor_type=data.monitor_type,
            auth_username=data.auth_username,
            auth_password_hash=auth_password_hash,
            criticality_index=data.criticality_index,
            alert_color=data.alert_color,
            check_interval_seconds=data.check_interval_seconds,
            is_active=data.is_active,
            tags=data.tags or {},
            notes=data.notes,
            created_by=user_id,
            last_status=MonitorStatus.UNKNOWN,
        )
        
        db.add(monitor)
        db.commit()
        db.refresh(monitor)
        logger.info(
            f"[SETTINGS] Monitor '{data.label}' creado por user_id={user_id}"
        )
        return monitor

    @staticmethod
    def update(
        db: Session,
        monitor_id: int,
        data: ServiceMonitorUpdate,
        user_id: Optional[int] = None,
    ) -> Optional[ServiceMonitor]:
        """Actualizar un monitor existente."""
        monitor = ServiceMonitorService.get_by_id(db, monitor_id)
        if monitor is None:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Manejar contraseña por separado (hashearla)
        if "auth_password" in update_data:
            if update_data["auth_password"] is not None:
                monitor.auth_password_hash = ServiceMonitorService.hash_password(
                    update_data["auth_password"]
                )
            del update_data["auth_password"]
        
        # Actualizar campos
        for field, value in update_data.items():
            setattr(monitor, field, value)
        
        db.commit()
        db.refresh(monitor)
        logger.info(
            f"[SETTINGS] Monitor ID={monitor_id} actualizado por user_id={user_id}"
        )
        return monitor

    @staticmethod
    def delete(db: Session, monitor_id: int) -> bool:
        """Eliminar un monitor. Retorna True si existía."""
        monitor = ServiceMonitorService.get_by_id(db, monitor_id)
        if monitor is None:
            return False
        db.delete(monitor)
        db.commit()
        logger.info(f"[SETTINGS] Monitor ID={monitor_id} eliminado")
        return True

    @staticmethod
    def update_status(
        db: Session,
        monitor_id: int,
        status: MonitorStatus,
        status_code: Optional[int] = None,
        response_time_ms: Optional[float] = None,
        error_message: Optional[str] = None,
    ) -> Optional[ServiceMonitor]:
        """Actualizar el estado de un monitor después de una verificación."""
        monitor = ServiceMonitorService.get_by_id(db, monitor_id)
        if monitor is None:
            return None
        
        monitor.last_status = status
        monitor.last_checked_at = datetime.now(timezone.utc)
        monitor.last_status_code = status_code
        monitor.response_time_ms = response_time_ms
        
        if error_message:
            monitor.last_error_message = error_message
        elif status == MonitorStatus.UP:
            monitor.last_error_message = None  # Limpiar error si está OK
        
        db.commit()
        db.refresh(monitor)
        
        # Registrar en historial automáticamente
        ServiceMonitorService.record_check_history(
            db, monitor_id, status,
            status_code=status_code,
            response_time_ms=response_time_ms,
            error_message=error_message,
        )
        
        return monitor

    @staticmethod
    def record_check_history(
        db: Session,
        monitor_id: int,
        status: MonitorStatus,
        status_code: Optional[int] = None,
        response_time_ms: Optional[float] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Registrar el resultado de una verificación en el historial.

        Cada verificación (manual o automática) se almacena en
        monitor_check_history para análisis histórico y reportes de uptime.

        Args:
            db: Sesión de base de datos.
            monitor_id: ID del monitor verificado.
            status: Estado resultante de la verificación.
            status_code: Código de estado (HTTP, exit code, etc.).
            response_time_ms: Tiempo de respuesta en milisegundos.
            error_message: Mensaje de error si la verificación falló.
        """
        try:
            history_entry = MonitorCheckHistory(
                monitor_id=monitor_id,
                status=status,
                status_code=status_code,
                response_time_ms=response_time_ms,
                error_message=error_message,
                checked_at=datetime.now(timezone.utc),
            )
            db.add(history_entry)
            db.commit()
        except Exception as e:
            logger.error(
                "[SETTINGS] Error al registrar historial de verificación "
                "para monitor_id=%s: %s", monitor_id, e
            )
            db.rollback()

    @staticmethod
    def get_stats(db: Session) -> dict:
        """Obtener estadísticas de monitores."""
        all_monitors = ServiceMonitorService.get_all(db)
        active = [m for m in all_monitors if m.is_active]
        down = [m for m in active if m.last_status == MonitorStatus.DOWN]
        critical_down = [
            m for m in down
            if m.criticality_index >= CriticalityIndex.HIGH
        ]
        
        return {
            "total": len(all_monitors),
            "active": len(active),
            "down": len(down),
            "critical_down": len(critical_down),
            "up": len([m for m in active if m.last_status == MonitorStatus.UP]),
            "unknown": len([m for m in active if m.last_status == MonitorStatus.UNKNOWN]),
        }


# ============================================
# SYNC STATUS SERVICE (para Tareas Programadas)
# ============================================

class SyncStatusService:
    """Servicio para consultar estado de tareas programadas."""

    @staticmethod
    def get_execution_history(
        db: Session,
        task_name: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list, int]:
        """
        Obtener historial de ejecuciones de sincronización.
        
        La tabla SyncStatus (del módulo Beholder) almacena registros
        de cada ejecución de las tareas programadas.
        """
        from src.models.beholder import SyncStatus
        
        # Contar total
        count_stmt = select(SyncStatus)
        if task_name:
            count_stmt = count_stmt.where(SyncStatus.fuente == task_name)
        total = db.execute(count_stmt).count() if not task_name else 0
        
        # Consultar registros
        stmt = select(SyncStatus)
        if task_name:
            stmt = stmt.where(SyncStatus.fuente == task_name)
        stmt = stmt.order_by(desc(SyncStatus.ultima_actualizacion))
        stmt = stmt.offset(offset).limit(limit)
        
        # Calcular total de forma más robusta
        if task_name:
            # Si hay filtro, contar manualmente
            count_result = db.execute(select(SyncStatus).where(
                SyncStatus.fuente == task_name
            ))
            total_query = count_result.fetchall()
            total = len(total_query)
        
        result = db.execute(stmt)
        items = list(result.scalars().all())
        
        return items, total
