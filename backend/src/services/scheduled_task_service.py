"""
Servicio para Scheduled Tasks V2.

Gestiona:
- CRUD de configuración de tareas programadas
- Ejecución forzada (trigger) vía Celery
- Consulta de logs de ejecución (sync_status)
- Sincronización desde Celery Beat schedule
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from src.models.beholder import SyncStatus
from src.models.scheduled_task import ScheduledTask
from src.utils.schedule_parser import schedule_config_to_cron

logger = logging.getLogger(__name__)

# Mapa de rutas cortas → rutas completas de Celery
# Necesario para compatibilidad con trigger por nombre corto
TASK_PATH_MAP: dict[str, str] = {
    "nightly_sync_task": "src.jobs.sync.nightly_sync_task",
    "cleanup_abandoned_work_orders": "cleanup_abandoned_work_orders",
    "cleanup_expired": "api_keys.cleanup_expired",
    "rotate_expiring": "api_keys.rotate_expiring",
    "alert_expiring": "api_keys.alert_expiring",
    "generate_audit_report": "api_keys.generate_audit_report",
}

REVERSE_TASK_PATH_MAP: dict[str, str] = {v: k for k, v in TASK_PATH_MAP.items()}


class ScheduledTaskService:
    """Servicio para gestionar tareas programadas persistentes."""

    @staticmethod
    def get_all(
        db: Session,
        category: Optional[str] = None,
        include_system: bool = False,
    ) -> list[ScheduledTask]:
        """Listar todas las tareas programadas, con filtros opcionales.

        Args:
            db: Sesión de base de datos.
            category: Filtrar por categoría (sync, maintenance, api_keys, general).
            include_system: Si es False, excluye tareas de sistema (is_system_task=True).

        Returns:
            Lista de ScheduledTask ordenada por categoría y display_name.
        """
        query = db.query(ScheduledTask)

        if category:
            query = query.filter(ScheduledTask.category == category)

        if not include_system:
            query = query.filter(ScheduledTask.is_system_task == False)  # noqa: E712

        return query.order_by(
            ScheduledTask.category,
            ScheduledTask.display_name,
        ).all()

    @staticmethod
    def get_by_id(db: Session, task_id: int) -> Optional[ScheduledTask]:
        """Obtener una tarea por su ID."""
        return db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()

    @staticmethod
    def get_by_task_name(db: Session, task_name: str) -> Optional[ScheduledTask]:
        """Obtener una tarea por su nombre único (task_name)."""
        return (
            db.query(ScheduledTask)
            .filter(ScheduledTask.task_name == task_name)
            .first()
        )

    @staticmethod
    def get_by_celery_path(db: Session, celery_path: str) -> Optional[ScheduledTask]:
        """Obtener una tarea por su ruta completa de Celery."""
        return (
            db.query(ScheduledTask)
            .filter(ScheduledTask.celery_task_path == celery_path)
            .first()
        )

    @staticmethod
    def update_config(
        db: Session,
        task_id: int,
        schedule_config: Optional[dict] = None,
        cron_expression: Optional[str] = None,
        is_active: Optional[bool] = None,
        max_executions: Optional[int] = None,
    ) -> Optional[ScheduledTask]:
        """Actualizar la configuración de una tarea programada.

        Si se proporciona schedule_config, se computa automáticamente
        la cron_expression a partir de él. Si se envían ambos, prevalece
        schedule_config.

        Args:
            db: Sesión de base de datos.
            task_id: ID de la tarea a actualizar.
            schedule_config: Configuración estructurada del schedule.
                Si se provee, cron_expression se computa automáticamente.
            cron_expression: Nueva expresión cron (None = no cambiar).
                Solo se usa si schedule_config es None.
            is_active: Nuevo estado activo/inactivo (None = no cambiar).
            max_executions: Nuevo máximo de ejecuciones.
                - None: no cambiar
                - -1 (sentinel): no cambiar (desde API)
                - 0: desactivar por límite alcanzado
                - valor positivo: nuevo límite

        Returns:
            ScheduledTask actualizada o None si no existe.
        """
        task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
        if not task:
            return None

        changed = False

        # Si se envía schedule_config, computar cron_expression automáticamente
        if schedule_config is not None:
            try:
                computed_cron = schedule_config_to_cron(schedule_config)
                task.schedule_config = schedule_config
                if computed_cron != task.cron_expression:
                    task.cron_expression = computed_cron
                    changed = True
            except ValueError as e:
                logger.error(
                    "Error computando cron desde schedule_config para "
                    "task_id=%d: %s", task_id, str(e),
                )
                raise ValueError(
                    f"Configuración de schedule inválida: {e}"
                ) from e
        elif cron_expression is not None and cron_expression != task.cron_expression:
            task.cron_expression = cron_expression
            changed = True

        if is_active is not None and is_active != task.is_active:
            task.is_active = is_active
            changed = True

        # max_executions = -1 es sentinel desde API (no cambiar)
        if max_executions is not None and max_executions != -1:
            if max_executions != task.max_executions:
                task.max_executions = max_executions
                changed = True

        if changed:
            db.commit()
            db.refresh(task)
            logger.info(
                "ScheduledTask config updated: id=%d name='%s' "
                "cron='%s' active=%s max_exec=%s",
                task.id, task.task_name,
                task.cron_expression, task.is_active, task.max_executions,
            )

        return task

    @staticmethod
    def trigger_task(
        db: Session,
        task_id: int,
    ) -> dict:
        """Forzar la ejecución inmediata de una tarea vía Celery.

        Args:
            db: Sesión de base de datos.
            task_id: ID de la tarea a ejecutar.

        Returns:
            Dict con resultado de la operación.

        Raises:
            ValueError: Si la tarea no existe.
        """
        task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
        if not task:
            raise ValueError(f"Tarea programada con ID {task_id} no encontrada")

        # Verificar límite de ejecuciones
        if task.max_executions is not None and task.execution_count >= task.max_executions:
            raise ValueError(
                f"La tarea '{task.display_name}' ha alcanzado su límite máximo "
                f"de {task.max_executions} ejecuciones"
            )

        try:
            from src.celery_app import celery_app

            result = celery_app.send_task(task.celery_task_path)
            task_id_str = str(result.id) if result else None

            # Incrementar contador y actualizar timestamp
            task.execution_count = (task.execution_count or 0) + 1
            task.last_execution_at = datetime.utcnow()
            task.last_execution_status = "running"
            db.commit()

            logger.info(
                "Task triggered: name='%s' celery_path='%s' task_id=%s",
                task.task_name, task.celery_task_path, task_id_str,
            )

            return {
                "success": True,
                "task_name": task.task_name,
                "display_name": task.display_name,
                "message": f"Tarea '{task.display_name}' enviada a ejecución",
                "task_id": task_id_str,
            }

        except Exception as e:
            logger.error(
                "Failed to trigger task '%s': %s",
                task.task_name, str(e), exc_info=True,
            )
            return {
                "success": False,
                "task_name": task.task_name,
                "display_name": task.display_name,
                "message": f"Error al ejecutar tarea: {str(e)}",
                "task_id": None,
            }

    @staticmethod
    def record_execution(
        db: Session,
        task_name: str,
        status: str,
        detail: Optional[str] = None,
    ) -> None:
        """Registrar una ejecución en la tabla de log (sync_status).

        También actualiza los campos de control en ScheduledTask.

        Args:
            db: Sesión de base de datos.
            task_name: Nombre de la tarea (task_name o celery_task_path).
            status: Estado de la ejecución (success, failed, running).
            detail: Detalle del resultado (ej: "Nodos: 12, ONUs: 45...").
        """
        # Buscar la tarea programada
        task = ScheduledTaskService.get_by_task_name(db, task_name)
        if not task:
            task = ScheduledTaskService.get_by_celery_path(db, task_name)

        if task:
            task.last_execution_at = datetime.utcnow()
            task.last_execution_status = status
            db.commit()

        # Registrar en sync_status (log histórico)
        log_entry = SyncStatus(
            fuente=task_name,
            estado=status,
            detalle=detail or "",
        )
        db.add(log_entry)
        db.commit()

        logger.info(
            "Execution recorded: task='%s' status=%s detail='%s'",
            task_name, status, (detail or "")[:100],
        )

    @staticmethod
    def get_execution_log(
        db: Session,
        task_name: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[SyncStatus], int]:
        """Obtener el historial de ejecuciones de una tarea desde sync_status.

        Args:
            db: Sesión de base de datos.
            task_name: Nombre de la tarea para filtrar.
            limit: Cantidad máxima de registros.
            offset: Desplazamiento para paginación.

        Returns:
            Tupla (lista de SyncStatus, total de registros).
        """
        query = db.query(SyncStatus).filter(SyncStatus.fuente == task_name)
        total = query.count()

        items = (
            query.order_by(desc(SyncStatus.ultima_actualizacion))
            .offset(offset)
            .limit(limit)
            .all()
        )

        return items, total

    @staticmethod
    def sync_from_beat_schedule(db: Session) -> int:
        """Sincronizar las tareas desde Celery Beat schedule.

        Actualiza:
        - cron_expression desde beat_schedule si existe
        - is_active según si la tarea está en beat_schedule

        No elimina tareas ni crea nuevas (solo actualiza existentes).

        Returns:
            Cantidad de tareas actualizadas.
        """
        try:
            from src.celery_app import celery_app

            beat_schedule = getattr(celery_app.conf, "beat_schedule", {})
        except Exception as e:
            logger.warning("Could not read Celery beat_schedule: %s", e)
            return 0

        updated = 0

        for schedule_key, schedule_config in beat_schedule.items():
            task_path = schedule_config.get("task", "")
            schedule_obj = schedule_config.get("schedule")

            # Buscar tarea por celery_task_path
            task = ScheduledTaskService.get_by_celery_path(db, task_path)
            if not task:
                # Intentar por task_name (el schedule_key podría ser el task_name)
                task = ScheduledTaskService.get_by_task_name(db, task_path)
            if not task:
                continue

            # Extraer expresión cron desde el objeto crontab
            cron_str = None
            if schedule_obj and hasattr(schedule_obj, "__str__"):
                try:
                    cron_str = str(schedule_obj)
                except Exception:
                    pass

            changed = False
            if cron_str and cron_str != task.cron_expression:
                task.cron_expression = cron_str
                changed = True

            if not task.is_active:
                task.is_active = True
                changed = True

            if changed:
                updated += 1

        if updated > 0:
            db.commit()
            logger.info("Synced %d tasks from Celery beat_schedule", updated)

        return updated
