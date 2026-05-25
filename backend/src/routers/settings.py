"""
Settings Router - API endpoints para configuración del sistema
Configuración general, monitores de servicio, y tareas programadas.

⚠️ IMPORTANTE: Las rutas específicas (monitors/, sync-status, sync-tasks)
   deben declararse ANTES que /{key} para evitar que FastAPI las interprete
   como un path parameter catch-all.
"""
from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.core.security import get_current_user, require_admin
from src.models.user import User
from src.models.settings import SystemConfig, ServiceMonitor, MonitorStatus
from src.schemas.settings import (
    SystemConfigCreate,
    SystemConfigUpdate,
    SystemConfigResponse,
    SystemConfigBulkUpdate,
    ServiceMonitorCreate,
    ServiceMonitorUpdate,
    ServiceMonitorResponse,
    ServiceMonitorListResponse,
    MonitorCheckResult,
    SyncExecutionHistoryItem,
    SyncExecutionHistoryResponse,
)
from src.schemas.scheduled_task import (
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
    ScheduledTaskTriggerResponse,
    ScheduledTaskLogResponse,
    ScheduledTaskSyncResponse,
)
from src.services.settings_service import (
    SystemConfigService,
    ServiceMonitorService,
    SyncStatusService,
)
from src.services.scheduled_task_service import ScheduledTaskService
from src.services.monitoring_engine import MonitoringOrchestrator

logger = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["Settings"])


# ============================================
# HELPER
# ============================================

def _get_user_id(user: Optional[User]) -> Optional[int]:
    """Extraer user_id de forma segura."""
    return user.id if user else None


# ============================================================
# SYSTEM CONFIG — LIST & BULK (no confluyen con /{key})
# ============================================================

@router.get("", response_model=List[SystemConfigResponse])
def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener todas las configuraciones del sistema.
    
    **Autenticación requerida:** JWT Token válido
    **Autorización:** Usuarios autenticados (lectura)
    """
    try:
        configs = SystemConfigService.get_all(db)
        return configs
    except Exception as e:
        logger.error(f"Error al listar configuraciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener configuraciones del sistema",
        )


@router.put("", response_model=List[SystemConfigResponse])
def update_settings(
    data: SystemConfigBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Actualizar múltiples configuraciones en batch.
    
    **Autenticación requerida:** Admin/Superuser
    **Body:** Diccionario key:value con las configuraciones a actualizar
    """
    try:
        user_id = _get_user_id(current_user)
        configs = SystemConfigService.bulk_update(db, data.settings, user_id=user_id)
        return configs
    except Exception as e:
        logger.error(f"Error al actualizar configuraciones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar configuraciones: {str(e)}",
        )


# ============================================
# SERVICE MONITOR ENDPOINTS
# ============================================

@router.get("/monitors", response_model=ServiceMonitorListResponse)
def list_monitors(
    active_only: bool = Query(False, description="Solo monitores activos"),
    criticality_min: Optional[int] = Query(
        None, ge=1, le=5,
        description="Criticidad mínima (1-5)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener todos los monitores de servicio.
    
    **Autenticación requerida:** JWT Token válido
    **Filtros:**
    - `active_only`: Solo monitores activos
    - `criticality_min`: Criticidad mínima (1-5)
    """
    try:
        monitors = ServiceMonitorService.get_all(
            db, active_only=active_only, criticality_min=criticality_min
        )
        
        # Calcular estadísticas
        active = [m for m in monitors if m.is_active]
        down = [m for m in active if m.last_status == MonitorStatus.DOWN]
        
        return ServiceMonitorListResponse(
            items=monitors,
            total=len(monitors),
            active_count=len(active),
            down_count=len(down),
        )
    except Exception as e:
        logger.error(f"Error al listar monitores: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener monitores de servicio",
        )


@router.get("/monitors/{monitor_id}", response_model=ServiceMonitorResponse)
def get_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener detalle de un monitor de servicio por ID.
    """
    monitor = ServiceMonitorService.get_by_id(db, monitor_id)
    if monitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitor ID={monitor_id} no encontrado",
        )
    return monitor


@router.post(
    "/monitors",
    response_model=ServiceMonitorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_monitor(
    data: ServiceMonitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Crear un nuevo monitor de servicio.
    
    **Autenticación requerida:** Admin/Superuser
    **Nota:** La contraseña se hashea automáticamente antes de almacenar.
    """
    try:
        user_id = _get_user_id(current_user)
        monitor = ServiceMonitorService.create(db, data, user_id=user_id)
        return monitor
    except Exception as e:
        logger.error(f"Error al crear monitor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear monitor: {str(e)}",
        )


@router.put("/monitors/{monitor_id}", response_model=ServiceMonitorResponse)
def update_monitor(
    monitor_id: int,
    data: ServiceMonitorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Actualizar un monitor de servicio existente.
    
    **Autenticación requerida:** Admin/Superuser
    **Nota:** Si se envía `auth_password`, se hashea automáticamente.
    """
    try:
        user_id = _get_user_id(current_user)
        monitor = ServiceMonitorService.update(db, monitor_id, data, user_id=user_id)
        if monitor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Monitor ID={monitor_id} no encontrado",
            )
        return monitor
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar monitor ID={monitor_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar monitor: {str(e)}",
        )


@router.delete("/monitors/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Eliminar un monitor de servicio.
    
    **Autenticación requerida:** Admin/Superuser
    """
    deleted = ServiceMonitorService.delete(db, monitor_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitor ID={monitor_id} no encontrado",
        )


@router.post("/monitors/{monitor_id}/check", response_model=MonitorCheckResult)
def check_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ejecutar una verificación manual de un monitor.
    
    **Autenticación requerida:** JWT Token válido
    
    Realiza una verificación inmediata del endpoint usando el
    motor de monitoreo interno (Strategy Pattern) y actualiza
    el estado del monitor en la base de datos.
    
    Soporta: PING, HTTP, TCP, SSL
    """
    monitor = ServiceMonitorService.get_by_id(db, monitor_id)
    if monitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitor ID={monitor_id} no encontrado",
        )
    
    try:
        # Ejecutar verificación con el motor de monitoreo
        result = MonitoringOrchestrator.run_check(monitor)
        
        # Actualizar estado en DB
        ServiceMonitorService.update_status(
            db, monitor_id, result.status,
            status_code=result.status_code,
            response_time_ms=result.response_time_ms,
            error_message=result.error_message,
        )
        
        db.refresh(monitor)
        
        return MonitorCheckResult(
            monitor_id=monitor.id,
            label=monitor.label,
            status=monitor.last_status,
            status_code=monitor.last_status_code,
            response_time_ms=monitor.response_time_ms,
            error_message=monitor.last_error_message,
            checked_at=monitor.last_checked_at or datetime.utcnow(),
        )
        
    except Exception as e:
        logger.error(f"Error al verificar monitor ID={monitor_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al verificar monitor: {str(e)}",
        )


@router.get("/monitors/stats/summary")
def get_monitor_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener estadísticas resumidas de todos los monitores.
    
    **Autenticación requerida:** JWT Token válido
    
    **Response:**
    - `total`: Total de monitores configurados
    - `active`: Monitores activos
    - `down`: Monitores caídos
    - `critical_down`: Monitores críticos caídos
    - `up`: Monitores funcionando
    - `unknown`: Monitores sin verificar
    """
    try:
        stats = ServiceMonitorService.get_stats(db)
        return stats
    except Exception as e:
        logger.error(f"Error al obtener estadísticas de monitores: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estadísticas",
        )


# ============================================
# SYNC STATUS ENDPOINTS (Tareas Programadas)
# ============================================

@router.get("/sync-status", response_model=SyncExecutionHistoryResponse)
def get_sync_status(
    task_name: Optional[str] = Query(
        None, description="Filtrar por nombre de tarea (fuente)"
    ),
    limit: int = Query(50, ge=1, le=200, description="Registros por página"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener historial de ejecuciones de tareas programadas.
    
    **Autenticación requerida:** JWT Token válido
    
    Lee desde la tabla SyncStatus (del módulo Beholder) que registra
    cada ejecución de las tareas programadas (nightly sync, etc.).
    """
    try:
        items, total = SyncStatusService.get_execution_history(
            db, task_name=task_name, limit=limit, offset=offset
        )
        
        return SyncExecutionHistoryResponse(
            items=[
                SyncExecutionHistoryItem(
                    id=item.id,
                    task_name=item.fuente,
                    started_at=item.created_at if hasattr(item, 'created_at') else item.ultima_actualizacion,
                    finished_at=item.ultima_actualizacion,
                    status="success" if item.estado == "ok" else "failed",
                    details={"detalle": item.detalle} if item.detalle else None,
                    error_message=item.detalle if item.estado != "ok" else None,
                )
                for item in items
            ],
            total=total,
        )
    except Exception as e:
        logger.error(f"Error al obtener historial de sync: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener historial de sincronización",
        )


# ============================================================
# SCHEDULED TASKS V2 — Gestión persistente de tareas programadas
# Reemplaza los antiguos endpoints /sync-tasks
# ============================================================


@router.get("/scheduled-tasks", response_model=List[ScheduledTaskResponse])
def list_scheduled_tasks(
    category: Optional[str] = Query(None, description="Filtrar por categoría: sync, maintenance, api_keys, general"),
    include_system: bool = Query(False, description="Incluir tareas de sistema (API keys)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Listar todas las tareas programadas con configuración persistente.

    **Autenticación requerida:** JWT Token válido

    **Query Params:**
    - `category`: Filtrar por categoría (sync, maintenance, api_keys, general)
    - `include_system`: Incluir tareas de sistema (ocultas por defecto)

    Retorna la configuración completa de cada tarea incluyendo:
    - Schedule (cron expression) configurable
    - Estado activo/inactivo
    - Historial de ejecución (última ejecución, contador)
    """
    return ScheduledTaskService.get_all(
        db,
        category=category,
        include_system=include_system,
    )


@router.get("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
def get_scheduled_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener detalle de una tarea programada por su ID.

    **Autenticación requerida:** JWT Token válido
    """
    task = ScheduledTaskService.get_by_id(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tarea programada con ID {task_id} no encontrada",
        )
    return task


@router.put("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
def update_scheduled_task(
    task_id: int,
    data: ScheduledTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Actualizar configuración de una tarea programada.

    **Autenticación requerida:** Admin/Superuser

    Permite modificar:
    - `schedule_config`: Configuración estructurada del schedule
       (ej: {"type":"daily","times":["03:00","20:00"]})
    - `cron_expression`: Expresión cron directa (ej: '0 3 * * *')
       Se ignora si se envía schedule_config
    - `is_active`: Activar/desactivar la tarea
    - `max_executions`: Límite de ejecuciones (null = ilimitado, 0 = desactivar)
    """
    task = ScheduledTaskService.update_config(
        db,
        task_id=task_id,
        schedule_config=data.schedule_config,
        cron_expression=data.cron_expression,
        is_active=data.is_active,
        max_executions=data.max_executions,
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tarea programada con ID {task_id} no encontrada",
        )
    return task


@router.post("/scheduled-tasks/{task_id}/trigger", response_model=ScheduledTaskTriggerResponse)
def trigger_scheduled_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Forzar la ejecución inmediata de una tarea programada.

    **Autenticación requerida:** Admin/Superuser

    La tarea se envía a Celery para ejecución asíncrona.
    El endpoint retorna inmediatamente con confirmación y el ID de la tarea Celery.
    """
    try:
        result = ScheduledTaskService.trigger_task(db, task_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/scheduled-tasks/{task_id}/logs", response_model=ScheduledTaskLogResponse)
def get_scheduled_task_logs(
    task_id: int,
    limit: int = Query(50, ge=1, le=200, description="Cantidad de registros"),
    offset: int = Query(0, ge=0, description="Desplazamiento para paginación"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener el historial de ejecuciones de una tarea programada.

    **Autenticación requerida:** JWT Token válido

    Retorna las últimas ejecuciones registradas en sync_status,
    ordenadas de más reciente a más antiguo.
    """
    task = ScheduledTaskService.get_by_id(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tarea programada con ID {task_id} no encontrada",
        )

    items, total = ScheduledTaskService.get_execution_log(
        db,
        task_name=task.task_name,
        limit=limit,
        offset=offset,
    )
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/scheduled-tasks/sync", response_model=ScheduledTaskSyncResponse)
def sync_scheduled_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Sincronizar tareas desde Celery Beat schedule.

    **Autenticación requerida:** Admin/Superuser

    Actualiza cron_expression e is_active de las tareas existentes
    según la configuración actual de beat_schedule en celery_app.py.
    """
    synced = ScheduledTaskService.sync_from_beat_schedule(db)
    return {
        "success": True,
        "tasks_synced": synced,
        "message": f"{synced} tarea(s) sincronizada(s) desde Celery Beat",
    }


# ============================================================
# SYSTEM CONFIG — PARAMETERIZED ENDPOINTS (/{key})
# Estas rutas DEBEN ir al final, después de todas las rutas
# específicas (monitors/, sync-status, scheduled-tasks) para evitar
# que FastAPI las interprete como catch-all de paths específicos.
# ============================================================

@router.get("/{key}", response_model=SystemConfigResponse)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener una configuración específica por su key.
    
    **Path Params:**
    - `key`: Identificador de la configuración (ej: company_name, work_hours)
    """
    config = SystemConfigService.get_by_key(db, key)
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuración '{key}' no encontrada",
        )
    return config


@router.put("/{key}", response_model=SystemConfigResponse)
def update_setting(
    key: str,
    data: SystemConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Actualizar una configuración específica.
    
    **Autenticación requerida:** Admin/Superuser
    **Path Params:** key de la configuración
    **Body:** Nuevo valor y descripción opcional
    """
    try:
        user_id = _get_user_id(current_user)
        config = SystemConfigService.upsert(
            db, key, data.value,
            description=data.description,
            user_id=user_id,
        )
        return config
    except Exception as e:
        logger.error(f"Error al actualizar configuración '{key}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar configuración: {str(e)}",
        )


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Eliminar una configuración del sistema.
    
    **Autenticación requerida:** Admin/Superuser
    """
    deleted = SystemConfigService.delete(db, key)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuración '{key}' no encontrada",
        )
